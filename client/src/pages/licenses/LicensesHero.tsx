import React from "react";
import {
  KeyRound,
  Plus,
  Search,
  Sparkles,
  CheckSquare,
  Minus,
} from "lucide-react";
import { cn } from "../../ui/cn/cn";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { pill } from "./utils";
import { S } from "./styles";
import type { Mode, SortDir, SortKey, Density } from "./types";

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
  return (
    <Card className={S.hero}>
      <div className={S.heroTopLine} />
      <div className={S.heroBlobL} />
      <div className={S.heroBlobR} />
      <div className={S.heroNoise} />

      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "h-12 w-12 rounded-3xl grid place-items-center",
                "bg-white/[0.04] border border-white/[0.10]",
                "shadow-[0_18px_70px_rgba(34,211,238,0.08)]"
              )}
            >
              <KeyRound className="h-6 w-6 text-cyan-200/85" />
            </div>

            <div className="min-w-0">
              <div className="text-xs text-white/50 tracking-wide">Registry</div>
              <div className={cn("mt-1 text-2xl font-semibold tracking-tight truncate", S.titleGrad)}>
                Licenses registry
              </div>
              <div className={cn("mt-1", S.subtitle)}>
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

        {/* TOOLBAR */}
        <div className={S.toolbar}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex items-center gap-2 text-white/70">
              <Search className="h-4 w-4" />
              <div className="text-sm font-semibold">Поиск и фильтры</div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-2">
              <div className={S.searchBox}>
                <Search className="h-4 w-4 text-white/45" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Поиск: product / vendor / type / note…"
                  className="w-full bg-transparent outline-none text-sm text-white/85 placeholder:text-white/35"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button className={S.chip(mode === "all")} onClick={() => setMode("all")} type="button">
                  All
                </button>
                <button className={S.chip(mode === "pinned")} onClick={() => setMode("pinned")} type="button">
                  Pinned
                </button>
                <button className={S.chip(mode === "risk")} onClick={() => setMode("risk")} type="button">
                  Risky
                </button>
                <button
                  className={S.chip(mode === "expiring")}
                  onClick={() => setMode("expiring")}
                  type="button"
                >
                  Expiring
                </button>
                <button
                  className={S.chip(mode === "deficit")}
                  onClick={() => setMode("deficit")}
                  type="button"
                >
                  Deficit
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[12px] text-white/45">
              <span>Shown:</span>
              <span className="font-semibold text-white/70 tabular-nums">{sortedCount}</span>
            </div>
          </div>

          {/* MINI STATS */}
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
            <div className={S.miniStat("none")}>
              <div className="text-[11px] opacity-80">Total</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{counts.total}</div>
            </div>
            <div className={S.miniStat(counts.risky ? "warn" : "ok")}>
              <div className="text-[11px] opacity-80">Risky</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{counts.risky}</div>
            </div>
            <div className={S.miniStat(counts.deficit ? "bad" : "ok")}>
              <div className="text-[11px] opacity-80">Deficit</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{counts.deficit}</div>
            </div>
            <div className={S.miniStat(counts.expiring ? "warn" : "ok")}>
              <div className="text-[11px] opacity-80">Expiring</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{counts.expiring}</div>
            </div>
            <div className={S.miniStat("ok")}>
              <div className="text-[11px] opacity-80">Healthy</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{counts.healthy}</div>
            </div>
          </div>

          {/* VIEW + SORT */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-white/45">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/40" />
              View:
            </span>

            <button
              type="button"
              onClick={() => setDensity((d) => (d === "comfortable" ? "compact" : "comfortable"))}
              className={cn(
                "rounded-2xl px-3 py-2 border text-sm font-semibold transition",
                "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/85"
              )}
            >
              Density: {density === "comfortable" ? "Comfort" : "Compact"}
            </button>

            <button
              type="button"
              onClick={() => setShowVendor((v) => !v)}
              className={cn(
                "rounded-2xl px-3 py-2 border text-sm font-semibold transition",
                showVendor
                  ? "border-white/[0.14] bg-white/[0.06] text-white/85"
                  : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/85"
              )}
            >
              Vendor
            </button>

            <button
              type="button"
              onClick={() => setShowType((v) => !v)}
              className={cn(
                "rounded-2xl px-3 py-2 border text-sm font-semibold transition",
                showType
                  ? "border-white/[0.14] bg-white/[0.06] text-white/85"
                  : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/85"
              )}
            >
              Type
            </button>

            <button
              type="button"
              onClick={() => setShowNote((v) => !v)}
              className={cn(
                "rounded-2xl px-3 py-2 border text-sm font-semibold transition",
                showNote
                  ? "border-white/[0.14] bg-white/[0.06] text-white/85"
                  : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/85"
              )}
            >
              Note
            </button>

            <span className="ml-2 inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/40" />
              Sort:
            </span>

            {(
              [
                ["status", "Status"],
                ["product", "Product"],
                ["vendor", "Vendor"],
                ["type", "Type"],
                ["seats", "Seats"],
                ["expires", "Expires"],
              ] as const
            )
              .filter(([k]) => {
                if (k === "vendor") return showVendor;
                if (k === "type") return showType;
                return true;
              })
              .map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onToggleSort(k)}
                  className={cn(
                    "rounded-2xl px-3 py-2 border text-sm font-semibold transition",
                    sortKey === k
                      ? "border-white/[0.14] bg-white/[0.06] text-white/85"
                      : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/85"
                  )}
                >
                  {label}
                  {sortKey === k && <span className="ml-2 text-white/45">{sortDir === "desc" ? "↓" : "↑"}</span>}
                </button>
              ))}
          </div>

          {bulkBar}
        </div>
      </div>
    </Card>
  );
}
