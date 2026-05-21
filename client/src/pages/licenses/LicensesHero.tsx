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
  RefreshCw,
} from "lucide-react";
import { cn } from "../../ui/cn/cn";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import type { Mode, SortDir, SortKey, Density } from "./types";

type SortItem = readonly [SortKey, string];

const SORT_ITEMS: readonly SortItem[] = [
  ["status", "Статус"],
  ["product", "Продукт"],
  ["vendor", "Производитель"],
  ["type", "Тип"],
  ["seats", "Места"],
  ["expires", "Срок"],
] as const;

function Toggle({
  active,
  onClick,
  children,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "bad" | "warn" | "ok";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium transition",
        active
          ? tone === "bad"
            ? "border-red-600 bg-red-600 text-white"
            : tone === "warn"
              ? "border-amber-500 bg-amber-500 text-white"
              : tone === "ok"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
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
  return (
    <div
      className={cn(
        "rounded-xl border bg-white px-4 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
        tone === "bad"
          ? "border-red-200"
          : tone === "warn"
            ? "border-amber-200"
            : tone === "ok"
              ? "border-emerald-200"
              : "border-slate-200"
      )}
    >
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "bad"
            ? "text-red-700"
            : tone === "warn"
              ? "text-amber-700"
              : tone === "ok"
                ? "text-emerald-700"
                : "text-slate-950"
        )}
      >
        {value}
      </div>
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
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <KeyRound className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="text-xl font-semibold text-slate-950">
                Реестр лицензий
              </div>

              <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Учёт лицензий организации: продукты, производители, типы лицензий,
                количество мест, сроки действия и рисковые записи.
              </div>

              <div className="mt-3 text-sm text-slate-500">
                Показано:{" "}
                <span className="font-semibold text-slate-900">{sortedCount}</span>{" "}
                из <span className="font-semibold text-slate-900">{counts.total}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Button variant="ghost" size="sm" onClick={onSeedDemo}>
              <Sparkles className="h-4 w-4" />
              Демо-данные
            </Button>

            {!selectMode ? (
              <Button variant="ghost" size="sm" onClick={onStartSelectMode}>
                <CheckSquare className="h-4 w-4" />
                Массовый выбор
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onStopSelectMode}>
                <Minus className="h-4 w-4" />
                Выйти из выбора
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={onReload} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Обновить
            </Button>

            <Button size="sm" onClick={onOpenAdd}>
              <Plus className="h-4 w-4" />
              Добавить лицензию
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MiniKpi label="Всего" value={counts.total} />
        <MiniKpi
          label="Рисковые"
          value={counts.risky}
          tone={counts.risky ? "warn" : "ok"}
        />
        <MiniKpi
          label="Дефицит"
          value={counts.deficit}
          tone={counts.deficit ? "bad" : "ok"}
        />
        <MiniKpi
          label="Истекают"
          value={counts.expiring}
          tone={counts.expiring ? "warn" : "ok"}
        />
        <MiniKpi label="Без проблем" value={counts.healthy} tone="ok" />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Search className="h-4 w-4" />
            <div className="text-sm font-semibold">Поиск и фильтры</div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-slate-100">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск: продукт, производитель, тип, примечание..."
                className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Toggle active={mode === "all"} onClick={() => setMode("all")}>
                Все
              </Toggle>

              <Toggle active={mode === "pinned"} onClick={() => setMode("pinned")}>
                Закреплённые
              </Toggle>

              <Toggle
                active={mode === "risk"}
                onClick={() => setMode("risk")}
                tone="warn"
              >
                Рисковые
              </Toggle>

              <Toggle
                active={mode === "expiring"}
                onClick={() => setMode("expiring")}
                tone="warn"
              >
                Истекают
              </Toggle>

              <Toggle
                active={mode === "deficit"}
                onClick={() => setMode("deficit")}
                tone="bad"
              >
                Дефицит
              </Toggle>
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Вид и сортировка
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", advancedOpen && "rotate-180")}
              />
            </button>

            <div className="text-xs text-slate-500">
              {advancedOpen
                ? "Настройки отображения открыты"
                : "Можно настроить плотность таблицы, колонки и сортировку"}
            </div>
          </div>

          {advancedOpen && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <LayoutGrid className="h-4 w-4 text-slate-500" />
                    Отображение
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Toggle
                      active={density === "comfortable"}
                      onClick={() => setDensity(() => "comfortable")}
                    >
                      Обычная плотность
                    </Toggle>

                    <Toggle
                      active={density === "compact"}
                      onClick={() => setDensity(() => "compact")}
                    >
                      Компактно
                    </Toggle>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Toggle active={showVendor} onClick={() => setShowVendor((v) => !v)}>
                      Производитель
                    </Toggle>

                    <Toggle active={showType} onClick={() => setShowType((v) => !v)}>
                      Тип
                    </Toggle>

                    <Toggle active={showNote} onClick={() => setShowNote((v) => !v)}>
                      Примечание
                    </Toggle>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ArrowUpDown className="h-4 w-4 text-slate-500" />
                    Сортировка
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {visibleSortItems.map(([k, label]) => (
                      <Toggle
                        key={k}
                        active={sortKey === k}
                        onClick={() => onToggleSort(k)}
                      >
                        {label}
                        {sortKey === k && (
                          <span className="ml-1 opacity-70">
                            {sortDir === "desc" ? "↓" : "↑"}
                          </span>
                        )}
                      </Toggle>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {bulkBar}
        </div>
      </Card>
    </div>
  );
}