import React from "react";
import {
  KeyRound,
  Plus,
  Search,
  Sparkles,
  CheckSquare,
  Minus,
  SlidersHorizontal,
  LayoutGrid,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";
import { cn } from "../../ui/cn/cn";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { pill } from "./utils";
import type { Mode, SortDir, SortKey, Density } from "./types";

type SortItem = readonly [SortKey, string];

const SORT_ITEMS: readonly SortItem[] = [
  ["status", "Status"],
  ["product", "Product"],
  ["vendor", "Vendor"],
  ["type", "Type"],
  ["seats", "Seats"],
  ["expires", "Expires"],
] as const;

function SoftToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl px-3 py-2 text-sm font-semibold transition",
        "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25",
        active
          ? [
              "border border-[rgba(120,155,205,0.26)]",
              "bg-[rgba(var(--card),0.42)]",
              "text-[rgba(var(--fg),0.92)]",
              "shadow-[0_10px_28px_rgba(0,0,0,0.22)]",
            ].join(" ")
          : [
              "border border-[rgba(100,130,170,0.16)]",
              "bg-[rgba(var(--card),0.22)]",
              "text-[rgba(var(--fg),0.70)]",
              "hover:bg-[rgba(var(--card),0.34)]",
              "hover:border-[rgba(120,155,205,0.24)]",
            ].join(" ")
      )}
    >
      {children}
    </button>
  );
}

function MiniKpi({
  label,
  value,
  tone = "none",
}: {
  label: string;
  value: number;
  tone?: "none" | "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "bad"
      ? "bg-rose-500/10 text-rose-100"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-100"
        : tone === "ok"
          ? "bg-emerald-500/10 text-emerald-100"
          : "bg-[rgba(var(--card),0.20)] text-[rgba(var(--fg),0.74)]";

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        "border-[rgba(100,130,170,0.16)]",
        cls
      )}
    >
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function LicensesHero({
  counts,
  loading,
  sortedCount,

  q,
  setQ,
  mode,
  setMode,

  selectMode,
  onStartSelectMode,
  onStopSelectMode,

  density,
  setDensity,
  showVendor,
  setShowVendor,
  showType,
  setShowType,
  showNote,
  setShowNote,

  sortKey,
  sortDir,
  onToggleSort,

  onSeedDemo,
  onReload,
  onOpenAdd,

  bulkBar,
}: {
  counts: { total: number; deficit: number; expiring: number; risky: number; healthy: number };
  loading: boolean;
  rowsCount: number;
  sortedCount: number;

  q: string;
  setQ: (v: string) => void;
  mode: Mode;
  setMode: (m: Mode) => void;

  selectMode: boolean;
  onStartSelectMode: () => void;
  onStopSelectMode: () => void;

  density: Density;
  setDensity: (fn: (d: Density) => Density) => void;
  showVendor: boolean;
  setShowVendor: (fn: (v: boolean) => boolean) => void;
  showType: boolean;
  setShowType: (fn: (v: boolean) => boolean) => void;
  showNote: boolean;
  setShowNote: (fn: (v: boolean) => boolean) => void;

  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (k: SortKey) => void;

  onSeedDemo: () => void;
  onReload: () => void;
  onOpenAdd: () => void;

  bulkBar: React.ReactNode;
}) {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const visibleSortItems = React.useMemo(() => {
    return SORT_ITEMS.filter(([k]) => {
      if (k === "vendor") return showVendor;
      if (k === "type") return showType;
      return true;
    });
  }, [showVendor, showType]);

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-3xl p-5",
        "bg-[linear-gradient(to_bottom,rgba(var(--bg),0.74),rgba(var(--bg),0.36))]",
        "shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/16 to-transparent" />
      <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-cyan-500/8 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/8 blur-3xl" />

      <div className="relative flex flex-col gap-5">
        {/* TOP */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={cn(
                "grid h-12 w-12 place-items-center rounded-3xl",
                "bg-[rgba(var(--fg),0.04)]",
                "shadow-[0_18px_70px_rgba(34,211,238,0.08)]"
              )}
            >
              <KeyRound className="h-6 w-6 text-cyan-300/85" />
            </div>

            <div className="min-w-0">
              <div className="text-xs tracking-wide text-[rgba(var(--fg),0.50)]">
                Registry
              </div>

              <div className="mt-1 truncate text-2xl font-semibold tracking-tight text-[rgb(var(--fg))]">
                Licenses registry
              </div>

              <div className="mt-1 text-sm text-[rgba(var(--fg),0.56)]">
                Реестр лицензий: seats, сроки, тип, vendor, заметки — всё в одном месте.
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={pill("none")}>
                  <Sparkles className="h-4 w-4 opacity-80" />
                  Local registry
                </span>
                <span className={pill(counts.deficit ? "bad" : "ok")}>
                  Deficit: <span className="tabular-nums">{counts.deficit}</span>
                </span>
                <span className={pill(counts.expiring ? "warn" : "ok")}>
                  Expiring: <span className="tabular-nums">{counts.expiring}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onSeedDemo} title="Добавить демо-данные">
              <Sparkles className="h-4 w-4" />
              Seed demo
            </Button>

            {!selectMode ? (
              <Button variant="ghost" size="sm" onClick={onStartSelectMode} title="Bulk mode">
                <CheckSquare className="h-4 w-4" />
                Bulk
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onStopSelectMode} title="Exit bulk mode">
                <Minus className="h-4 w-4" />
                Exit bulk
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={onReload} disabled={loading} title="Обновить список">
              Обновить
            </Button>

            <Button variant="primary" size="sm" onClick={onOpenAdd} title="Добавить лицензию">
              <Plus className="h-4 w-4" />
              Add license
            </Button>
          </div>
        </div>

        {/* MAIN CONTROLS */}
        <div
          className={cn(
            "rounded-[28px] border p-4",
            "border-[rgba(100,130,170,0.16)]",
            "bg-[linear-gradient(to_bottom,rgba(var(--card),0.24),rgba(var(--card),0.10))]"
          )}
        >
          <div className="flex flex-col gap-3">
            {/* search + mode + shown */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="flex items-center gap-2 text-[rgba(var(--fg),0.72)]">
                <Search className="h-4 w-4" />
                <div className="text-sm font-semibold">Поиск и режим</div>
              </div>

              <div className="flex-1 flex flex-col gap-3 lg:flex-row">
                <div
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3.5 py-3",
                    "border border-[rgba(100,130,170,0.16)]",
                    "bg-[rgba(var(--card),0.20)]"
                  )}
                >
                  <Search className="h-4 w-4 shrink-0 text-[rgba(var(--fg),0.42)]" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Поиск: product / vendor / type / note…"
                    className="w-full bg-transparent text-sm text-[rgba(var(--fg),0.88)] outline-none placeholder:text-[rgba(var(--fg),0.35)]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <SoftToggle active={mode === "all"} onClick={() => setMode("all")}>
                    All
                  </SoftToggle>
                  <SoftToggle active={mode === "pinned"} onClick={() => setMode("pinned")}>
                    Pinned
                  </SoftToggle>
                  <SoftToggle active={mode === "risk"} onClick={() => setMode("risk")}>
                    Risky
                  </SoftToggle>
                  <SoftToggle active={mode === "expiring"} onClick={() => setMode("expiring")}>
                    Expiring
                  </SoftToggle>
                  <SoftToggle active={mode === "deficit"} onClick={() => setMode("deficit")}>
                    Deficit
                  </SoftToggle>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[12px] text-[rgba(var(--fg),0.45)]">
                <span>Shown:</span>
                <span className="font-semibold tabular-nums text-[rgba(var(--fg),0.78)]">
                  {sortedCount}
                </span>
              </div>
            </div>

            {/* compact KPI row */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              <MiniKpi label="Total" value={counts.total} tone="none" />
              <MiniKpi label="Risky" value={counts.risky} tone={counts.risky ? "warn" : "ok"} />
              <MiniKpi label="Deficit" value={counts.deficit} tone={counts.deficit ? "bad" : "ok"} />
              <MiniKpi label="Expiring" value={counts.expiring} tone={counts.expiring ? "warn" : "ok"} />
              <MiniKpi label="Healthy" value={counts.healthy} tone="ok" />
            </div>

            {/* secondary actions row */}
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
                    "border border-[rgba(100,130,170,0.16)]",
                    "bg-[rgba(var(--card),0.22)]",
                    "text-[rgba(var(--fg),0.80)] transition",
                    "hover:bg-[rgba(var(--card),0.34)] hover:border-[rgba(120,155,205,0.24)]",
                    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  View & sort
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      advancedOpen && "rotate-180"
                    )}
                  />
                </button>
              </div>

              <div className="text-[12px] text-[rgba(var(--fg),0.45)]">
                {advancedOpen
                  ? "Панель настройки открыта"
                  : "Раскрой панель для density, колонок и сортировки"}
              </div>
            </div>

            {/* advanced panel */}
            {advancedOpen && (
              <div
                className={cn(
                  "rounded-[24px] border p-4",
                  "border-[rgba(100,130,170,0.16)]",
                  "bg-[linear-gradient(to_bottom,rgba(var(--card),0.18),rgba(var(--card),0.08))]"
                )}
              >
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  {/* view */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[rgba(var(--fg),0.78)]">
                      <LayoutGrid className="h-4 w-4 text-cyan-400" />
                      View
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SoftToggle
                        active={density === "comfortable"}
                        onClick={() => setDensity(() => "comfortable")}
                      >
                        Density: Comfort
                      </SoftToggle>

                      <SoftToggle
                        active={density === "compact"}
                        onClick={() => setDensity(() => "compact")}
                      >
                        Density: Compact
                      </SoftToggle>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <SoftToggle active={showVendor} onClick={() => setShowVendor((v) => !v)}>
                        Vendor
                      </SoftToggle>

                      <SoftToggle active={showType} onClick={() => setShowType((v) => !v)}>
                        Type
                      </SoftToggle>

                      <SoftToggle active={showNote} onClick={() => setShowNote((v) => !v)}>
                        Note
                      </SoftToggle>
                    </div>
                  </div>

                  {/* sort */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[rgba(var(--fg),0.78)]">
                      <ArrowUpDown className="h-4 w-4 text-cyan-400" />
                      Sort
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {visibleSortItems.map(([k, label]) => (
                        <SoftToggle
                          key={k}
                          active={sortKey === k}
                          onClick={() => onToggleSort(k)}
                        >
                          {label}
                          {sortKey === k && (
                            <span className="ml-1 text-[rgba(var(--fg),0.48)]">
                              {sortDir === "desc" ? "↓" : "↑"}
                            </span>
                          )}
                        </SoftToggle>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {bulkBar}
          </div>
        </div>
      </div>
    </Card>
  );
}