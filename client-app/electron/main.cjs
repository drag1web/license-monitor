const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { app, BrowserWindow, ipcMain, Tray, Menu } = require("electron");

const LICENSE_FILE = path.join(app.getPath("userData"), "license.json");
const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");

const DEFAULT_SETTINGS = {
  server_url: process.env.LICENSE_SERVER_URL || "http://localhost:3000",
  check_interval: 10,
};

let mainWindow = null;
let tray = null;
let forceQuit = false;

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return DEFAULT_SETTINGS;

    const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
    const data = JSON.parse(raw);

    return {
      server_url:
        typeof data.server_url === "string" && data.server_url.trim()
          ? data.server_url.trim()
          : DEFAULT_SETTINGS.server_url,

      check_interval:
        Number.isFinite(Number(data.check_interval)) &&
          Number(data.check_interval) >= 3
          ? Number(data.check_interval)
          : DEFAULT_SETTINGS.check_interval,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(data) {
  const current = readSettings();

  const next = {
    server_url:
      typeof data.server_url === "string" && data.server_url.trim()
        ? data.server_url.trim()
        : current.server_url,

    check_interval:
      Number.isFinite(Number(data.check_interval)) &&
        Number(data.check_interval) >= 3
        ? Number(data.check_interval)
        : current.check_interval,
  };

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

function getServerUrl() {
  return readSettings().server_url;
}

function getDeviceName() {
  return process.env.DEVICE_NAME || os.hostname();
}

function getDeviceId() {
  const raw = [
    os.hostname(),
    os.userInfo().username,
    os.platform(),
    os.arch(),
  ].join("|");

  const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return `device_${hash}`;
}

function readLicense() {
  if (!fs.existsSync(LICENSE_FILE)) return null;

  try {
    const raw = fs.readFileSync(LICENSE_FILE, "utf-8");
    const data = JSON.parse(raw);

    if (!data.license_key) return null;
    return data;
  } catch {
    return null;
  }
}

function saveLicense(licenseKey) {
  fs.writeFileSync(
    LICENSE_FILE,
    JSON.stringify(
      {
        license_key: String(licenseKey).trim(),
        activated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

function removeLicense() {
  if (fs.existsSync(LICENSE_FILE)) {
    fs.rmSync(LICENSE_FILE);
  }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }

  return JSON.parse(text);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 820,
    minHeight: 560,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL("http://127.0.0.1:5174");

  mainWindow.on("close", (event) => {
    if (forceQuit || !tray) return;

    console.log("WINDOW HIDE TO TRAY");

    event.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "icon.ico");

  if (!fs.existsSync(iconPath)) {
    console.warn("TRAY: icon.ico not found, tray disabled");
    tray = null;
    return;
  }

  tray = new Tray(iconPath);
  tray.setToolTip("Entitlex — клиент лицензирования");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Открыть Entitlex",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Выход",
      click: () => {
        forceQuit = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

ipcMain.handle("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle("window:maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.handle("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle("settings:get", async () => {
  return readSettings();
});

ipcMain.handle("settings:set", async (_event, data) => {
  return saveSettings(data ?? {});
});

ipcMain.handle("license:device", async () => {
  return {
    device_id: getDeviceId(),
    device_name: getDeviceName(),
    server_url: getServerUrl(),
  };
});

ipcMain.handle("license:check", async () => {
  const stored = readLicense();

  if (!stored?.license_key) {
    return {
      ok: true,
      valid: false,
      reason: "no_license",
    };
  }

  return postJson(`${getServerUrl()}/api/license/check`, {
    license_key: stored.license_key,
    device_id: getDeviceId(),
  });
});

ipcMain.handle("license:activate", async (_event, licenseKey) => {
  const cleanKey = String(licenseKey || "").trim();

  if (!cleanKey) {
    return {
      ok: true,
      valid: false,
      reason: "invalid_payload",
    };
  }

  const result = await postJson(`${getServerUrl()}/api/license/activate`, {
    license_key: cleanKey,
    device_id: getDeviceId(),
    device_name: getDeviceName(),
  });

  if (result.valid) {
    saveLicense(cleanKey);
  }

  return result;
});

ipcMain.handle("license:deactivate", async () => {
  const stored = readLicense();

  if (!stored?.license_key) {
    removeLicense();
    return {
      ok: true,
      deactivated: false,
    };
  }

  const result = await postJson(`${getServerUrl()}/api/license/deactivate`, {
    license_key: stored.license_key,
    device_id: getDeviceId(),
  });

  removeLicense();
  return result;
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  if (!tray) {
    console.log("APP: tray disabled, window will close normally");
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !tray) {
    app.quit();
  }
});