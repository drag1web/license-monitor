import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  cleanupDeleteAll,
  cleanupKeepLast,
  cleanupOlderThan,
  deleteRunsBulk,
  download,
  getRuns,
  type RunRow,
} from "../api";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn/cn";
import { Dropdown } from "../components/Dropdown";
import { ConfirmDialog } from "../ui/modal/ConfirmDialog";
import { useConfirmDialog } from "../ui/modal/useConfirmDialog";
import { ViewerNotice } from "../components/ViewerNotice";
import { useAuth } from "../auth/AuthContext";
import {
  Table,
  TableInner,
  TableScroll,
  TableCaption,
  TableEmpty,
  TableSkeleton,
  THead,
  TBody,
  Tr,
  Td,
  SortTh,
} from "../ui/Table";
import {
  Menu,
  Trash2,
  X,
  CheckSquare,
  Square,
  RefreshCw,
  Download as DownloadIcon,
  Copy,
  Layers,
  CalendarClock,
  ShieldAlert,
  Minus,
  TimerReset,
  HardDrive,
  Skull,
  History,
  ArrowUpRight,
  Activity,
  Sparkles,
} from "lucide-react";

/* ------------------------------------------
 * Sorting helpers
 * ------------------------------------------ */

type SortKey =
  | "id"
  | "run_at"
  | "total_products"
  | "deficit_products"
  | "expiring_products"
  | "unmatched_installs";

type SortDir = "asc" | "desc" | null;

function nextDir(d: SortDir): SortDir {
  if (d === null) return "asc";
  if (d === "asc") return "desc";
  return null;
}

function parseTime(s: unknown) {
  const t = Date.parse(String(s));
  return Number.isFinite(t) ? t : 0;
}

const numKeys: Set<SortKey> = new Set([
  "id",
  "total_products",
  "deficit_products",
  "expiring_products",
  "unmatched_installs",
]);

function getNum(r: RunRow, k: SortKey) {
  const v = r[k];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cmp(key: SortKey, dir: Exclude<SortDir, null>) {
  const mul = dir === "asc" ? 1 : -1;
  return (a: RunRow, b: RunRow) => {
    if (key === "run_at") return (parseTime(a.run_at) - parseTime(b.run_at)) * mul;
    if (numKeys.has(key)) return (getNum(a, key) - getNum(b, key)) * mul;
    return String(a[key]).localeCompare(String(b[key])) * mul;
  };
}

function isRiskyRun(r: RunRow) {
  return !!(r.deficit_products || r.expiring_products || r.unmatched_installs);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------
 * Small UI bits
 * ------------------------------------------ */

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="px-3 pt-3 pb-2 text-[11px] text-[rgba(var(--fg),0.45)]">{title}</div>
      {children}
    </>
  );
}

function MenuDivider() {
  return <div className="h-px bg-[rgba(100,130,170,0.14)]" />;
}

function MenuItem({
  icon,
  title,
  description,
  right,
  onClick,
  href,
  disabled,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  right?: React.ReactNode;
  onClick?: () => void | Promise<void>;
  href?: string;
  disabled?: boolean;
  tone?: "default" | "danger" | "warn";
}) {
  const base = cn(
    "w-full text-left px-3 py-2",
    "flex items-center gap-2 text-sm",
    "transition-colors",
    disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-[rgba(var(--card),0.18)]"
  );

  const titleCls =
    tone === "danger"
      ? "text-rose-100"
      : tone === "warn"
        ? "text-amber-100"
        : "text-[rgba(var(--fg),0.90)]";

  if (href) {
    return (
      <a
        className={base}
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
      >
        {icon}
        <div className="min-w-0">
          <div className={cn("font-semibold", titleCls)}>{title}</div>
          {description && <div className="text-[11px] text-[rgba(var(--fg),0.45)]">{description}</div>}
        </div>
        {right && <div className="ml-auto text-[11px] text-[rgba(var(--fg),0.40)]">{right}</div>}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={base}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onClick?.();
      }}
    >
      {icon}
      <div className="min-w-0">
        <div className={cn("font-semibold", titleCls)}>{title}</div>
        {description && <div className="text-[11px] text-[rgba(var(--fg),0.45)]">{description}</div>}
      </div>
      {right && <div className="ml-auto text-[11px] text-[rgba(var(--fg),0.40)]">{right}</div>}
    </button>
  );
}

function SummaryChip({
  label,
  value,
  tone = "none",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "none" | "ok" | "warn" | "bad";
}) {
  const cls =
    tone === "bad"
      ? "bg-rose-500/10 text-rose-100"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-100"
        : tone === "ok"
          ? "bg-emerald-500/10 text-emerald-100"
          : "bg-[rgba(var(--card),0.22)] text-[rgba(var(--fg),0.74)]";

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        "border-[rgba(100,130,170,0.14)]",
        cls
      )}
    >
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/* ------------------------------------------
 * Page
 * ------------------------------------------ */

export default function Runs() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const [sortKey, setSortKey] = useState<SortKey>("run_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLSpanElement | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  const [busy, setBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  const confirm = useConfirmDialog();

  const refresh = useCallback(async () => {
    setErr("");
    setLoading(true);
    setRefreshBusy(true);
    try {
      const data = await getRuns();
      setRuns(data);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
      setRefreshBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAdmin && selectMode) {
      setSelectMode(false);
      setSelected(new Set());
    }
  }, [isAdmin, selectMode]);

  const toggleSort = useCallback((key: SortKey, defaultDir: Exclude<SortDir, null>) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) {
        setSortDir(defaultDir);
        return key;
      }
      setSortDir((d) => nextDir(d));
      return prevKey;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortDir) return runs;
    const arr = [...runs];
    arr.sort(cmp(sortKey, sortDir));
    return arr;
  }, [runs, sortKey, sortDir]);

  const visible = useMemo(() => sorted.slice(0, 50), [sorted]);
  const last = sorted[0];

  const riskyCount = useMemo(() => {
    let c = 0;
    for (const r of visible) if (isRiskyRun(r)) c++;
    return c;
  }, [visible]);

  const allVisibleSelected = useMemo(() => {
    if (visible.length === 0) return false;
    for (const r of visible) if (!selected.has(r.id)) return false;
    return true;
  }, [visible, selected]);

  const totalProducts = useMemo(() => {
    return last?.total_products ?? 0;
  }, [last]);

  const totalDeficit = useMemo(() => {
    return last?.deficit_products ?? 0;
  }, [last]);

  const totalExpiring = useMemo(() => {
    return last?.expiring_products ?? 0;
  }, [last]);

  const totalUnmatched = useMemo(() => {
    return last?.unmatched_installs ?? 0;
  }, [last]);

  const startSelectMode = useCallback(() => {
    if (!isAdmin) return;
    setMenuOpen(false);
    setSelectMode(true);
    setSelected(new Set());
  }, [isAdmin]);

  const cancelSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const withSelection = useCallback(
    (action: () => void) => {
      if (!isAdmin) return;

      setMenuOpen(false);
      if (!selectMode) {
        setSelectMode(true);
        setSelected(new Set());
      }
      queueMicrotask(action);
    },
    [isAdmin, selectMode]
  );

  const toggleOne = useCallback((id: number) => {
    if (!isAdmin) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [isAdmin]);

  const toggleAllVisible = useCallback(() => {
    if (!isAdmin) return;

    setSelected((prev) => {
      if (visible.length === 0) return prev;
      const next = new Set(prev);
      const every = visible.every((r) => next.has(r.id));
      if (every) for (const r of visible) next.delete(r.id);
      else for (const r of visible) next.add(r.id);
      return next;
    });
  }, [isAdmin, visible]);

  const invertSelection = useCallback(() => {
    setSelected((prev) => {
      const next = new Set<number>();
      for (const r of visible) if (!prev.has(r.id)) next.add(r.id);
      return next;
    });
  }, [visible]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectLastN = useCallback(
    (n: number) => setSelected(new Set(visible.slice(0, n).map((r) => r.id))),
    [visible]
  );

  const selectRiskyOnly = useCallback(
    () => setSelected(new Set(visible.filter(isRiskyRun).map((r) => r.id))),
    [visible]
  );

  const onCopyLastId = useCallback(async () => {
    if (!last) return;
    const ok = await copyToClipboard(String(last.id));
    setErr(ok ? "" : "Не удалось скопировать в clipboard (браузер запретил доступ).");
  }, [last]);

  const deleteSelected = useCallback(async () => {
    if (!isAdmin) return;

    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const ok = await confirm.ask({
      title: `Delete ${ids.length} runs?`,
      description: "Операция удалит выбранные записи из истории.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;

    setErr("");
    setBusy(true);
    try {
      const res = await deleteRunsBulk(ids);
      if (!(res as any)?.ok) {
        setErr((res as any)?.error ?? "bulk delete failed");
        return;
      }

      const idSet = new Set(ids);
      setRuns((prev) => prev.filter((r) => !idSet.has(r.id)));
      cancelSelectMode();

      const deleted = (res as any)?.deleted ?? ids.length;
      const notFound = (res as any)?.notFound ?? 0;
      if (notFound) setErr(`Удалено: ${deleted}. Не найдено: ${notFound}.`);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, [isAdmin, selected, confirm, cancelSelectMode]);

  const doOlderThan = useCallback(
    async (days: number) => {
      if (!isAdmin) return;

      const ok = await confirm.ask({
        title: `Delete runs older than ${days} days?`,
        description: "Удалит историю запусков, которые старше указанного порога.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true,
      });
      if (!ok) return;

      setMenuOpen(false);
      setErr("");
      setBusy(true);
      try {
        await cleanupOlderThan(days);
        await refresh();
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      } finally {
        setBusy(false);
      }
    },
    [isAdmin, confirm, refresh]
  );

  const doKeepLast = useCallback(
    async (keepLast: number) => {
      if (!isAdmin) return;

      const phrase = `KEEP_LAST_${keepLast}`;

      const ok = await confirm.ask({
        title: `Keep only last ${keepLast}?`,
        description: "Остальные runs будут удалены. Это нельзя отменить.",
        confirmLabel: "Apply",
        cancelLabel: "Cancel",
        danger: true,
        requireText: phrase,
      });
      if (!ok) return;

      setMenuOpen(false);
      setErr("");
      setBusy(true);
      try {
        await cleanupKeepLast(keepLast, phrase);
        await refresh();
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      } finally {
        setBusy(false);
      }
    },
    [isAdmin, confirm, refresh]
  );

  const doDeleteAll = useCallback(async () => {
    if (!isAdmin) return;

    const ok = await confirm.ask({
      title: "Delete ALL runs?",
      description: "Удалит всю историю запусков (полная очистка). Это нельзя отменить.",
      confirmLabel: "DELETE ALL",
      cancelLabel: "Cancel",
      danger: true,
      requireText: "DELETE_ALL",
    });
    if (!ok) return;

    setMenuOpen(false);
    setErr("");
    setBusy(true);
    try {
      await cleanupDeleteAll("DELETE_ALL");
      await refresh();
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }, [isAdmin, confirm, refresh]);

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirm.open}
        title={confirm.cfg.title}
        description={confirm.cfg.description}
        confirmLabel={confirm.cfg.confirmLabel}
        cancelLabel={confirm.cfg.cancelLabel}
        danger={confirm.cfg.danger}
        requireText={confirm.cfg.requireText}
        value={confirm.value}
        onValueChange={confirm.setValue}
        busy={busy}
        onCancel={confirm.cancel}
        onConfirm={confirm.confirm}
      />

      {!isAdmin && (
        <ViewerNotice message="У вас нет прав на удаление и очистку истории запусков. Доступен только просмотр истории." />
      )}

      {/* HERO */}
      <Card
        className={cn(
          "relative overflow-hidden rounded-3xl p-5 md:p-6",
          "bg-[linear-gradient(to_bottom,rgba(var(--bg),0.74),rgba(var(--bg),0.36))]",
          "shadow-[0_24px_80px_rgba(0,0,0,0.34)]"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/16 to-transparent" />
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-indigo-500/8 blur-3xl" />

        <div className="relative space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-3xl bg-[rgba(var(--fg),0.04)] shadow-[0_18px_70px_rgba(34,211,238,0.08)]">
                <History className="h-7 w-7 text-cyan-300/85" />
              </div>

              <div className="min-w-0">
                <div className="text-xs tracking-wide text-[rgba(var(--fg),0.46)]">
                  История
                </div>

                <div className="mt-1 text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">
                  История запусков
                </div>

                <div className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[rgba(var(--fg),0.58)]">
                  История прогонов, результаты сопоставления и быстрые действия по очистке.
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-2xl bg-[rgba(var(--card),0.22)] px-3 py-1.5 text-[12px] font-semibold text-[rgba(var(--fg),0.76)]">
                    <Sparkles className="h-4 w-4 opacity-80" />
                    История проверок
                  </span>

                  {last && (
                    <span className="inline-flex items-center gap-2 text-[12px] text-[rgba(var(--fg),0.46)]">
                      <CalendarClock className="h-4 w-4" />
                      <span>Последний запуск: #{last.id}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                disabled={refreshBusy || busy}
                title="Обновить"
              >
                <RefreshCw className={cn("h-4 w-4", refreshBusy && "animate-spin")} />
                Обновить
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!last) return;
                  await onCopyLastId();
                }}
                disabled={!last || busy}
                title="Copy last run id"
              >
                <Copy className="h-4 w-4" />
                Копировать ID
              </Button>

              <a
                href={download.runsCsv}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold",
                  "border border-[rgba(100,130,170,0.16)] bg-[rgba(var(--card),0.22)]",
                  "text-[rgba(var(--fg),0.86)] hover:bg-[rgba(var(--card),0.34)]",
                  "transition"
                )}
              >
                <DownloadIcon className="h-4 w-4" />
                Экспорт runs.csv
              </a>

              <span ref={menuAnchorRef} className="inline-flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMenuOpen((v) => !v)}
                  title="Options"
                  disabled={busy}
                >
                  <Menu className="h-4 w-4" />
                  Действия
                </Button>
              </span>

              <Dropdown
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                anchorRef={menuAnchorRef as any}
                width={340}
                align="end"
                sideOffset={10}
              >
                <MenuSection title="Действия">
                  {isAdmin && (
                    <MenuItem
                      icon={<Trash2 className="h-4 w-4 text-rose-200/90" />}
                      title="Удалить запуски..."
                      description="Включить режим выбора"
                      right={runs.length}
                      disabled={busy}
                      onClick={startSelectMode}
                    />
                  )}

                  <MenuItem
                    icon={
                      <RefreshCw
                        className={cn("h-4 w-4 text-cyan-200/80", refreshBusy && "animate-spin")}
                      />
                    }
                    title="Обновить"
                    description="Перезагрузить список запусков"
                    disabled={refreshBusy || busy}
                    onClick={async () => {
                      setMenuOpen(false);
                      await refresh();
                    }}
                  />

                  <MenuItem
                    icon={<DownloadIcon className="h-4 w-4 text-cyan-200/80" />}
                    title="Экспорт runs.csv"
                    description="Скачать историю запусков"
                    href={download.runsCsv}
                    disabled={busy}
                    onClick={() => setMenuOpen(false)}
                  />

                  <MenuItem
                    icon={<Copy className="h-4 w-4 text-cyan-200/80" />}
                    title="Копировать ID последнего запуска"
                    description={`Быстро скопировать #${last?.id ?? "—"}`}
                    disabled={!last || busy}
                    onClick={async () => {
                      setMenuOpen(false);
                      await onCopyLastId();
                    }}
                  />
                </MenuSection>

                {isAdmin && (
                  <>
                    <MenuDivider />

                    <MenuSection title="Инструменты выделения">
                      <MenuItem
                        icon={<CalendarClock className="h-4 w-4 text-[rgba(var(--fg),0.65)]" />}
                        title="Выбрать последние 10"
                        description="Из видимых 50"
                        disabled={busy}
                        onClick={() => withSelection(() => selectLastN(10))}
                      />

                      <MenuItem
                        icon={<ShieldAlert className="h-4 w-4 text-amber-200/80" />}
                        title="Выбрать только рискованные"
                        description="deficit/expiring/unmatched"
                        right={riskyCount}
                        disabled={busy}
                        onClick={() => withSelection(selectRiskyOnly)}
                        tone="warn"
                      />

                      <MenuItem
                        icon={<Layers className="h-4 w-4 text-[rgba(var(--fg),0.65)]" />}
                        title="Инвертировать выделение"
                        description="В пределах видимых 50"
                        disabled={busy}
                        onClick={() => withSelection(invertSelection)}
                      />

                      <MenuItem
                        icon={<Minus className="h-4 w-4 text-[rgba(var(--fg),0.65)]" />}
                        title="Снять выделение"
                        description="Снять всё"
                        disabled={busy}
                        onClick={() => withSelection(clearSelection)}
                      />
                    </MenuSection>

                    <MenuDivider />

                    <MenuSection title="Очистка истории">
                      <MenuItem
                        icon={<TimerReset className="h-4 w-4 text-amber-200/80" />}
                        title="Удалить старше 30 дней"
                        description="Очистка по возрасту"
                        disabled={busy}
                        onClick={() => doOlderThan(30)}
                        tone="warn"
                      />

                      <MenuItem
                        icon={<TimerReset className="h-4 w-4 text-amber-200/80" />}
                        title="Удалить старше 90 дней"
                        description="Очистка по возрасту"
                        disabled={busy}
                        onClick={() => doOlderThan(90)}
                        tone="warn"
                      />

                      <MenuDivider />

                      <MenuItem
                        icon={<HardDrive className="h-4 w-4 text-rose-200/90" />}
                        title="Оставить только последние 50"
                        description="Потребует ввод KEEP_LAST_50"
                        disabled={busy}
                        onClick={() => doKeepLast(50)}
                        tone="danger"
                      />

                      <MenuItem
                        icon={<HardDrive className="h-4 w-4 text-rose-200/90" />}
                        title="Оставить только последние 200"
                        description="Потребует ввод KEEP_LAST_200"
                        disabled={busy}
                        onClick={() => doKeepLast(200)}
                        tone="danger"
                      />

                      <MenuDivider />

                      <MenuItem
                        icon={<Skull className="h-4 w-4 text-rose-200/90" />}
                        title="Удалить все запуски"
                        description="Потребует ввод DELETE_ALL"
                        disabled={busy}
                        onClick={doDeleteAll}
                        tone="danger"
                      />
                    </MenuSection>
                  </>
                )}

                <MenuDivider />

                <MenuItem
                  icon={<X className="h-4 w-4 text-[rgba(var(--fg),0.60)]" />}
                  title="Закрыть"
                  disabled={busy}
                  onClick={() => setMenuOpen(false)}
                />
              </Dropdown>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryChip label="Всего запусков" value={runs.length} tone="none" />
            <SummaryChip label="Рискованные" value={riskyCount} tone={riskyCount ? "warn" : "ok"} />
            <SummaryChip label="Продукты" value={totalProducts} tone="none" />
            <SummaryChip label="Дефицит" value={totalDeficit} tone={totalDeficit ? "bad" : "ok"} />
            <SummaryChip label="Истекающие / Несопоставленные" value={`${totalExpiring}/${totalUnmatched}`} tone={totalExpiring || totalUnmatched ? "warn" : "ok"} />
          </div>

          {last && (
            <div className="rounded-2xl bg-[rgba(var(--card),0.18)] px-4 py-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-[11px] text-[rgba(var(--fg),0.46)]">Последний запуск</div>
                  <div className="mt-1 text-sm font-semibold text-[rgba(var(--fg),0.86)]">
                    #{last.id} • {last.run_at}
                  </div>
                </div>

                <Link
                  to={`/runs/${last.id}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
                    "border border-[rgba(100,130,170,0.16)] bg-[rgba(var(--card),0.24)]",
                    "text-[rgba(var(--fg),0.86)] hover:bg-[rgba(var(--card),0.36)]",
                    "transition"
                  )}
                >
                  Открыть последний
                  <ArrowUpRight className="h-4 w-4 text-[rgba(var(--fg),0.46)]" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </Card>

      {err && (
        <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-rose-100">Ошибка</div>
          <div className="mt-1 break-words text-xs text-rose-200/80">{err}</div>
        </div>
      )}

      {/* TABLE */}
      <Card
        className={cn(
          "rounded-3xl overflow-hidden p-0",
          "bg-[linear-gradient(to_bottom,rgba(var(--bg),0.70),rgba(var(--bg),0.34))]",
          "shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
        )}
      >
        <Table>
          <TableCaption
            title="Журнал запусков"
            description="Сводка по последним проверкам и результатам сопоставления."
            right={
              isAdmin && selectMode ? (
                <div className="flex items-center gap-2">
                  <div className="text-[11px] text-[rgba(var(--fg),0.45)]">
                    Выбрано: <span className="text-[rgba(var(--fg),0.80)]">{selected.size}</span>
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy || selected.size === 0}
                    onClick={deleteSelected}
                    className="min-w-[160px] justify-center"
                    title={selected.size === 0 ? "Ничего не выбрано" : "Удалить выбранные"}
                  >
                    <Trash2 className="h-4 w-4" />
                    {busy ? "Удаление…" : "Удалить выбранные"}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={cancelSelectMode}
                    title="Cancel selection mode"
                  >
                    <X className="h-4 w-4" />
                    Отмена
                  </Button>
                </div>
              ) : (
                <div className="text-[11px] text-[rgba(var(--fg),0.45)]">Последние 50</div>
              )
            }
          />

          {loading ? (
            <TableSkeleton rows={6} cols={isAdmin && selectMode ? 7 : 6} />
          ) : visible.length === 0 ? (
            <TableEmpty
              title="Пока нет запусков"
              description={
                isAdmin
                  ? "Запусти проверку лицензий — и тут появится история."
                  : "История запусков пока пуста."
              }
            />
          ) : (
            <TableScroll className="max-h-[60vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    {isAdmin && selectMode && (
                      <th className="px-3 py-2 text-left">
                        <button
                          onClick={toggleAllVisible}
                          className={cn(
                            "inline-flex items-center gap-2",
                            "text-xs text-[rgba(var(--fg),0.60)] hover:text-[rgba(var(--fg),0.82)] transition-colors"
                          )}
                          title={allVisibleSelected ? "Unselect all" : "Select all (visible)"}
                          type="button"
                        >
                          {allVisibleSelected ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">Все</span>
                        </button>
                      </th>
                    )}

                    <SortTh
                      label="id"
                      dir={sortKey === "id" ? sortDir : null}
                      onToggle={() => toggleSort("id", "asc")}
                      hint="Сортировать по идентификатору"
                    />
                    <SortTh
                      label="дата запуска"
                      dir={sortKey === "run_at" ? sortDir : null}
                      onToggle={() => toggleSort("run_at", "desc")}
                      hint="Сортировать по дате запуска"
                    />
                    <SortTh
                      label="продукты"
                      dir={sortKey === "total_products" ? sortDir : null}
                      onToggle={() => toggleSort("total_products", "desc")}
                      hint="Сортировать по количеству продуктов"
                    />
                    <SortTh
                      label="дефицит"
                      dir={sortKey === "deficit_products" ? sortDir : null}
                      onToggle={() => toggleSort("deficit_products", "desc")}
                      hint="Сортировать по количеству дефицитов"
                    />
                    <SortTh
                      label="истекают"
                      dir={sortKey === "expiring_products" ? sortDir : null}
                      onToggle={() => toggleSort("expiring_products", "desc")}
                      hint="Сортировать по количеству истекающих"
                    />
                    <SortTh
                      label="несопоставленные"
                      dir={sortKey === "unmatched_installs" ? sortDir : null}
                      onToggle={() => toggleSort("unmatched_installs", "desc")}
                      hint="Сортировать по количеству несопоставленных"
                    />
                  </tr>
                </THead>

                <TBody>
                  {visible.map((r) => {
                    const checked = selected.has(r.id);
                    const risky = isRiskyRun(r);

                    return (
                      <Tr
                        key={r.id}
                        className={cn(
                          isAdmin && selectMode && checked && "bg-[rgba(var(--card),0.14)]",
                          risky && "border-l-2 border-amber-300/25"
                        )}
                      >
                        {isAdmin && selectMode && (
                          <Td>
                            <button
                              onClick={() => toggleOne(r.id)}
                              className={cn(
                                "inline-flex items-center justify-center",
                                "h-8 w-8 rounded-xl",
                                "hover:bg-[rgba(var(--card),0.20)] transition-colors"
                              )}
                              title={checked ? "Unselect" : "Select"}
                              type="button"
                            >
                              {checked ? (
                                <CheckSquare className="h-4 w-4 text-cyan-200" />
                              ) : (
                                <Square className="h-4 w-4 text-[rgba(var(--fg),0.50)]" />
                              )}
                            </button>
                          </Td>
                        )}

                        <Td>
                          <Link
                            className={cn(
                              "inline-flex items-center gap-2",
                              "font-semibold text-cyan-200/90 hover:text-cyan-200",
                              "hover:underline underline-offset-4"
                            )}
                            to={`/runs/${r.id}`}
                          >
                            #{r.id}
                            <span className="text-[11px] font-normal text-[rgba(var(--fg),0.35)]">Детали</span>
                          </Link>
                        </Td>

                        <Td className="text-[rgba(var(--fg),0.70)]">{r.run_at}</Td>
                        <Td className="tabular-nums">{r.total_products}</Td>

                        <Td
                          className={cn(
                            "tabular-nums",
                            r.deficit_products ? "text-rose-200" : "text-[rgba(var(--fg),0.74)]"
                          )}
                        >
                          {r.deficit_products}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums",
                            r.expiring_products ? "text-amber-200" : "text-[rgba(var(--fg),0.74)]"
                          )}
                        >
                          {r.expiring_products}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums",
                            r.unmatched_installs ? "text-amber-200" : "text-[rgba(var(--fg),0.74)]"
                          )}
                        >
                          {r.unmatched_installs}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </TableInner>
            </TableScroll>
          )}
        </Table>
      </Card>
    </div>
  );
}