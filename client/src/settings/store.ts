import type {
  Density,
  LicensesMode,
  RunsLimit,
  Settings,
  StartRoute,
  Theme,
} from "./types";

const KEY = "lm_settings_v2";

/* ------------------------------------------
 * Defaults
 * ------------------------------------------ */

export const defaultSettings: Settings = {
  theme: "graphite",
  density: "comfortable",
  reduceMotion: false,

  perf: {
    disableBackdropBlur: false,
    simplifyShadows: false,
    disableRowShine: false,
    disableEffectsWhileScroll: true, // 🔥 дефолт включаем
  },

  startRoute: "/",
  autoRefreshSec: 0,
  confirmBeforeRun: true,
  confirmBeforeDelete: true,
  rememberFilters: true,

  data: {
    runsLimit: 200,
    showOnlyTopDiff: false,

    defaultModeLicenses: "all",
    showVendor: true,
    showType: true,
    showNote: true,
    stickyHeader: true,
  },

  advanced: {
    showDevPanel: false,
    allowDangerZone: false,
  },
};

/* ------------------------------------------
 * Helpers (safe parsing)
 * ------------------------------------------ */

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function pickBool(v: unknown, fallback: boolean): boolean {
  return v === undefined ? fallback : Boolean(v);
}

function pickEnum<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  const s = String(v);
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

function pickNum(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function pickNumEnum<T extends number>(
  v: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return (allowed as readonly number[]).includes(n) ? (n as T) : fallback;
}

/* ------------------------------------------
 * Sanitizer / Migration
 * ------------------------------------------ */

const THEMES = ["graphite", "midnight", "snow"] as const satisfies readonly Theme[];
const DENSITIES = ["comfortable", "compact"] as const satisfies readonly Density[];
const ROUTES = ["/", "/runs", "/licenses"] as const satisfies readonly StartRoute[];
const RUNS_LIMITS = [50, 100, 200, 500] as const satisfies readonly RunsLimit[];
const LICENSES_MODES = ["all", "risk", "expiring", "deficit", "pinned"] as const satisfies readonly LicensesMode[];

export function sanitizeSettings(raw: unknown): Settings {
  const r = isObj(raw) ? raw : {};
  const perf = isObj(r.perf) ? r.perf : {};
  const data = isObj(r.data) ? r.data : {};
  const advanced = isObj(r.advanced) ? r.advanced : {};

  const next: Settings = {
    theme: pickEnum(r.theme, THEMES, defaultSettings.theme),
    density: pickEnum(r.density, DENSITIES, defaultSettings.density),
    reduceMotion: pickBool(r.reduceMotion, defaultSettings.reduceMotion),

    perf: {
      disableBackdropBlur: pickBool(
        perf.disableBackdropBlur,
        defaultSettings.perf.disableBackdropBlur
      ),
      simplifyShadows: pickBool(
        perf.simplifyShadows,
        defaultSettings.perf.simplifyShadows
      ),
      disableRowShine: pickBool(
        perf.disableRowShine,
        defaultSettings.perf.disableRowShine
      ),
      disableEffectsWhileScroll: pickBool(
        perf.disableEffectsWhileScroll,
        defaultSettings.perf.disableEffectsWhileScroll
      ),
    },

    startRoute: pickEnum(r.startRoute, ROUTES, defaultSettings.startRoute),
    autoRefreshSec: pickNum(
      r.autoRefreshSec,
      0,
      3600,
      defaultSettings.autoRefreshSec
    ),
    confirmBeforeRun: pickBool(
      r.confirmBeforeRun,
      defaultSettings.confirmBeforeRun
    ),
    confirmBeforeDelete: pickBool(
      r.confirmBeforeDelete,
      defaultSettings.confirmBeforeDelete
    ),
    rememberFilters: pickBool(
      r.rememberFilters,
      defaultSettings.rememberFilters
    ),

    data: {
      runsLimit: pickNumEnum(
        data.runsLimit,
        RUNS_LIMITS,
        defaultSettings.data.runsLimit
      ),
      showOnlyTopDiff: pickBool(
        data.showOnlyTopDiff,
        defaultSettings.data.showOnlyTopDiff
      ),

      defaultModeLicenses: pickEnum(
        data.defaultModeLicenses,
        LICENSES_MODES,
        defaultSettings.data.defaultModeLicenses
      ),
      showVendor: pickBool(data.showVendor, defaultSettings.data.showVendor),
      showType: pickBool(data.showType, defaultSettings.data.showType),
      showNote: pickBool(data.showNote, defaultSettings.data.showNote),
      stickyHeader: pickBool(data.stickyHeader, defaultSettings.data.stickyHeader),
    },

    advanced: {
      showDevPanel: pickBool(
        advanced.showDevPanel,
        defaultSettings.advanced.showDevPanel
      ),
      allowDangerZone: pickBool(
        advanced.allowDangerZone,
        defaultSettings.advanced.allowDangerZone
      ),
    },
  };

  return next;
}

/* ------------------------------------------
 * Import / Export
 * ------------------------------------------ */

export function exportSettingsJson(s: Settings): string {
  return JSON.stringify(s, null, 2);
}

export function importSettingsJson(txt: string): Settings {
  const raw = JSON.parse(txt) as unknown;
  return sanitizeSettings(raw);
}

/* ------------------------------------------
 * LocalStorage
 * ------------------------------------------ */

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    return importSettingsJson(raw);
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, exportSettingsJson(sanitizeSettings(s)));
  } catch {
    // ignore
  }
}
