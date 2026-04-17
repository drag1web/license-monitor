const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { createLicensesRepo } = require("./licensesRepo.cjs");

let win;
let licensesRepo;

const preloadPath = path.join(__dirname, "preload.cjs");
console.log("PRELOAD PATH:", preloadPath);
console.log("PRELOAD EXISTS:", fs.existsSync(preloadPath));

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    backgroundColor: "#060B16",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  win.setMenu(null);

  const isDev = !app.isPackaged;
  const url = isDev ? "http://127.0.0.1:5173" : "http://127.0.0.1:3000";
  win.loadURL(url);

  if (isDev) win.webContents.openDevTools({ mode: "detach" });

  globalShortcut.register("F12", () => win?.webContents.toggleDevTools());
  globalShortcut.register("CommandOrControl+Shift+I", () =>
    win?.webContents.toggleDevTools()
  );

  win.webContents.on("did-fail-load", (_e, code, desc, u) => {
    console.error("did-fail-load", { code, desc, url: u });
  });
}

ipcMain.handle("win:minimize", () => win?.minimize());

ipcMain.handle("win:maximize", () => {
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});

ipcMain.handle("win:close", () => win?.close());
ipcMain.handle("win:isMaximized", () => !!win?.isMaximized());

function ensureRepo() {
  if (!licensesRepo) throw new Error("licensesRepo not initialized");
  return licensesRepo;
}

ipcMain.handle("licenses:list", async () => ensureRepo().list());
ipcMain.handle("licenses:upsert", async (_e, row) => ensureRepo().upsert(row));
ipcMain.handle("licenses:remove", async (_e, id) => ensureRepo().remove(id));

app.whenReady().then(() => {
  licensesRepo = createLicensesRepo(app.getPath("userData"));
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});