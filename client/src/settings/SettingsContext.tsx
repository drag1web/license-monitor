import React from "react";
import type { Settings } from "./types";
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  sanitizeSettings,
} from "./store";

type Ctx = {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  reset: () => void;
  patch: (p: Partial<Settings>) => void;
};

const SettingsContext = React.createContext<Ctx | null>(null);

/** Cheap deep clone for our small settings object */
function cloneSettings(s: Settings): Settings {
  // structuredClone есть почти везде, но если хочешь поддержать старые окружения — можно заменить.
  return structuredClone ? structuredClone(s) : (JSON.parse(JSON.stringify(s)) as Settings);
}

function applyRootClasses(s: Settings) {
  const root = document.documentElement;

  // theme
  root.classList.remove("theme-graphite", "theme-midnight", "theme-snow");
  root.classList.add(`theme-${s.theme}`);

  // reduce motion
  root.classList.toggle("reduce-motion", !!s.reduceMotion);

  // dev panel flag
  root.classList.toggle("dev", !!s.advanced.showDevPanel);

  // perf: effects while scroll mode flag (ты это используешь в таблице/стилях)
  root.classList.toggle("perf-scroll-enabled", !!s.perf.disableEffectsWhileScroll);

  // perf flags
  root.classList.toggle("perf-no-blur", !!s.perf.disableBackdropBlur);
  root.classList.toggle("perf-soft-shadows", !!s.perf.simplifyShadows);
  root.classList.toggle("perf-no-rowshine", !!s.perf.disableRowShine);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<Settings>(() => {
    // loadSettings уже парсит JSON; sanitize — гарантирует соответствие типам/дефолтам
    return sanitizeSettings(loadSettings());
  });

  // persist (sanitized)
  React.useEffect(() => {
    saveSettings(settings);
    // позже можно дергать Electron API:
    // window.electron?.store?.set?.("settings", settings);
  }, [settings]);

  // Apply all root classes in one place (less churn)
  React.useEffect(() => {
    applyRootClasses(settings);
  }, [settings]);

  const reset = React.useCallback(() => {
    // важно: новая ссылка, чтобы React точно увидел изменение
    setSettings(() => cloneSettings(defaultSettings));
  }, []);

  const patch = React.useCallback((p: Partial<Settings>) => {
    // Patch на верхнем уровне; для вложенных полей всё равно чаще удобнее setSettings((s)=>({...s,...}))
    setSettings((prev) => sanitizeSettings({ ...prev, ...p }));
  }, []);

  // Wrap setSettings to always sanitize (even if someone sets junk)
  const setSettingsSafe = React.useCallback<
    React.Dispatch<React.SetStateAction<Settings>>
  >((updater) => {
    setSettings((prev) => {
      const next = typeof updater === "function" ? (updater as any)(prev) : updater;
      return sanitizeSettings(next);
    });
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({
      settings,
      setSettings: setSettingsSafe,
      reset,
      patch,
    }),
    [settings, setSettingsSafe, reset, patch]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
