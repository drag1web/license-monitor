import { useCallback, useEffect, useState } from "react";

import {
  activateLicense,
  checkLicense as checkLicenseRequest,
  deactivateLicense,
  getCachedLicenseState,
  getDeviceInfo,
  getSettings,
  saveSettings,
  rememberValidCheck,
  hasOfflineGrace,
  clearValidCheckMemory,
  type DeviceInfo,
  type Screen,
} from "./services/licenseService.js";

import { Shell } from "./components/Shell.js";
import { GlassCard } from "./components/GlassCard.js";
import { DeviceInfoGrid } from "./components/DeviceInfoGrid.js";
import { ActivationPanel } from "./components/ActivationPanel.js";
import { ProtectedWorkspace } from "./components/ProtectedWorkspace.js";
import { LicenseStatusCard } from "./components/LicenseStatusCard.js";
import { RuntimePanel } from "./components/RuntimePanel.js";
import { AppHeader } from "./components/AppHeader.js";
import { LoadingScreen } from "./components/LoadingScreen.js";
import { AppLockedOverlay } from "./components/AppLockedOverlay.js";
import { SettingsModal, type ClientSettings } from "./components/SettingsModal.js";

export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [key, setKey] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [activationId, setActivationId] = useState<number | null>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastCheckAt, setLastCheckAt] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);

  const [settings, setSettings] = useState<ClientSettings>({
    server_url: "http://localhost:3000",
    check_interval: 10,
  });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const checkIntervalSec = Math.max(3, Number(settings.check_interval) || 10);

  const checkLicense = useCallback(async () => {
    try {
      const result = await checkLicenseRequest();

      setLastCheckAt(new Date().toLocaleTimeString());

      if (result.valid) {
        setOfflineMode(false);

        rememberValidCheck({
          activation_id: result.activation_id,
          expires_at: result.expires_at,
        });

        setExpiresAt(result.expires_at);
        setActivationId(result.activation_id);
        setReason("");
        setScreen("valid");

        return true;
      }

      if (result.reason === "no_license") {
        setOfflineMode(false);
        setScreen("activation");
        setReason("");
        return false;
      }

      clearValidCheckMemory();
      setOfflineMode(false);
      setReason(result.reason);
      setScreen("invalid");
      return false;
    } catch {
      if (hasOfflineGrace()) {
        const cached = getCachedLicenseState();

        setOfflineMode(true);
        setReason("");
        setActivationId(cached?.activation_id ?? null);
        setExpiresAt(cached?.expires_at ?? null);
        setLastCheckAt("offline");
        setScreen("valid");

        return true;
      }

      setOfflineMode(false);
      setReason("server_error");
      setScreen("invalid");
      return false;
    }
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const nextSettings = await getSettings();
        setSettings(nextSettings);

        const info = await getDeviceInfo();
        setDevice(info);

        const cached = getCachedLicenseState();

        if (cached) {
          setActivationId(cached.activation_id ?? null);
          setExpiresAt(cached.expires_at ?? null);
          setLastCheckAt("cached");

          // НЕ показываем valid сразу
          // ждём checkLicense()
        }
      } catch {
        // ignore
      }

      await checkLicense();
    }

    boot();
  }, [checkLicense]);

  useEffect(() => {
    if (screen !== "valid") return;

    const id = window.setInterval(() => {
      checkLicense();
    }, checkIntervalSec * 1000);

    return () => window.clearInterval(id);
  }, [screen, checkLicense, checkIntervalSec]);

  async function manualCheck() {
    setCheckingNow(true);

    try {
      await checkLicense();
    } finally {
      setCheckingNow(false);
    }
  }

  async function activate() {
    const cleanKey = key.trim();

    if (!cleanKey) {
      setOfflineMode(false);
      setReason("invalid_payload");
      setScreen("invalid");
      return;
    }

    setBusy(true);
    setScreen("loading");

    try {
      const result = await activateLicense(cleanKey);

      if (result.valid) {
        setOfflineMode(false);

        rememberValidCheck({
          activation_id: result.activation_id,
          expires_at: result.expires_at,
        });

        setExpiresAt(result.expires_at);
        setActivationId(result.activation_id);
        setReason("");
        setScreen("valid");
        setLastCheckAt(new Date().toLocaleTimeString());

        return;
      }

      clearValidCheckMemory();
      setOfflineMode(false);
      setReason(result.reason);
      setScreen("invalid");
    } catch {
      setOfflineMode(false);
      setReason("server_error");
      setScreen("invalid");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);

    try {
      await deactivateLicense();

      clearValidCheckMemory();
      setOfflineMode(false);
      setKey("");
      setReason("");
      setActivationId(null);
      setExpiresAt(null);
      setScreen("activation");
    } finally {
      setBusy(false);
    }
  }

  async function saveClientSettings(next: ClientSettings) {
    setSettingsSaving(true);

    try {
      const saved = await saveSettings(next);
      setSettings(saved);

      const info = await getDeviceInfo();
      setDevice(info);

      await checkLicense();
      setSettingsOpen(false);
    } finally {
      setSettingsSaving(false);
    }
  }

  if (screen === "loading") {
    return <LoadingScreen />;
  }

  return (
    <Shell>
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        saving={settingsSaving}
        onClose={() => setSettingsOpen(false)}
        onSave={saveClientSettings}
      />

      <GlassCard className="w-full max-w-5xl">
        <div className="p-6 md:p-7">
          <AppHeader
            screen={screen}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <DeviceInfoGrid device={device} lastCheckAt={lastCheckAt} />

          <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              {screen === "activation" || screen === "invalid" ? (
                <ActivationPanel
                  screen={screen}
                  licenseKey={key}
                  busy={busy}
                  onKeyChange={setKey}
                  onActivate={activate}
                  onTryAnotherKey={() => setScreen("activation")}
                />
              ) : (
                <ProtectedWorkspace
                  activationId={activationId}
                  expiresAt={expiresAt}
                  busy={busy}
                  lastCheckAt={lastCheckAt}
                  offlineMode={offlineMode}
                  serverUrl={settings.server_url}
                  deviceName={device?.device_name ?? ""}
                  onDeactivate={deactivate}
                />
              )}
            </div>

            <div className="space-y-4">
              <LicenseStatusCard
                screen={screen}
                reason={reason}
                offlineMode={offlineMode}
                expiresAt={expiresAt}
              />

              <RuntimePanel checking={checkingNow} onCheckNow={manualCheck} />
            </div>
          </div>
        </div>

        {screen === "invalid" && reason && (
          <AppLockedOverlay
            reason={reason}
            onCheckAgain={checkLicense}
            onEnterAnotherKey={() => {
              setKey("");
              setReason("");
              setScreen("activation");
            }}
          />
        )}
      </GlassCard>
    </Shell>
  );
}