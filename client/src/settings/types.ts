export type Theme = "graphite" | "midnight" | "snow";
export type Density = "comfortable" | "compact";

export type StartRoute = "/" | "/runs" | "/licenses";

export type RunsLimit = 50 | 100 | 200 | 500;
export type LicensesMode = "all" | "risk" | "expiring" | "deficit" | "pinned";

export type Settings = {
  // UI
  theme: Theme;
  density: Density;
  reduceMotion: boolean;

  // Performance
  perf: {
    disableBackdropBlur: boolean;
    simplifyShadows: boolean;
    disableRowShine: boolean;
    disableEffectsWhileScroll: boolean;
  };

  // Behavior
  startRoute: StartRoute;
  autoRefreshSec: number; // 0=off
  confirmBeforeRun: boolean;
  confirmBeforeDelete: boolean;
  rememberFilters: boolean;

  // Tables / Data
  data: {
    runsLimit: RunsLimit;
    showOnlyTopDiff: boolean;

    defaultModeLicenses: LicensesMode;
    showVendor: boolean;
    showType: boolean;
    showNote: boolean;
    stickyHeader: boolean;
  };

  // Safety / Advanced
  advanced: {
    showDevPanel: boolean;
    allowDangerZone: boolean;
  };
};
