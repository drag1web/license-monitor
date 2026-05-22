import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  cleanupDeleteAll,
  cleanupKeepLast,
  cleanupOlderThan,
  deleteRunsBulk,
  download,
  downloadProtectedFile,
  getRuns,
  runCheck,
  type RunRow,
} from "../api";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn/cn";
import { Dropdown } from "../components/Dropdown";
import { ConfirmDialog } from "../ui/modal/ConfirmDialog";
import { useConfirmDialog } from "../ui/modal/useConfirmDialog";
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
} from "lucide-react";

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
    if (key === "run_at") {
      return (parseTime(a.run_at) - parseTime(b.run_at)) * mul;
    }

    if (numKeys.has(key)) {
      return (getNum(a, key) - getNum(b, key)) * mul;
    }

    return String(a[key]).localeCompare(String(b[key])) * mul;
  };
}

function isRiskyRun(r: RunRow) {
  return Boolean(
    r.deficit_products ||
    r.expiring_products ||
    r.unmatched_installs
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function MenuSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      {children}
    </>
  );
}

function MenuDivider() {
  return <div className="my-1 h-px bg-slate-200" />;
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
    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
    disabled
      ? "cursor-not-allowed opacity-50"
      : "hover:bg-slate-50"
  );

  const titleCls =
    tone === "danger"
      ? "text-red-700"
      : tone === "warn"
        ? "text-amber-700"
        : "text-slate-800";

  const content = (
    <>
      <span className="text-slate-500">{icon}</span>

      <div className="min-w-0">
        <div className={cn("font-semibold", titleCls)}>{title}</div>
        {description && (
          <div className="text-[11px] leading-4 text-slate-500">
            {description}
          </div>
        )}
      </div>

      {right && (
        <div className="ml-auto text-[11px] text-slate-400">
          {right}
        </div>
      )}
    </>
  );

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
        {content}
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
      {content}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "ok" | "warn" | "bad";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
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

export default function Runs() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navigate = useNavigate();
  const [runBusy, setRunBusy] = useState(false);

  async function runAndOpen() {
    if (!isAdmin) return;

    setRunBusy(true);
    setErr("");

    try {
      const out = await runCheck();

      if (!out.ok) {
        throw new Error(out.error || "Не удалось запустить проверку");
      }

      window.dispatchEvent(new CustomEvent("alerts:refresh"));

      if (out.runId) {
        navigate(`/runs/${out.runId}`);
        return;
      }

      navigate("/runs");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRunBusy(false);
    }
  }

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

  const toggleSort = useCallback(
    (key: SortKey, defaultDir: Exclude<SortDir, null>) => {
      setSortKey((prevKey) => {
        if (prevKey !== key) {
          setSortDir(defaultDir);
          return key;
        }

        setSortDir((d) => nextDir(d));
        return prevKey;
      });
    },
    []
  );

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
    for (const r of visible) {
      if (isRiskyRun(r)) c++;
    }
    return c;
  }, [visible]);

  const allVisibleSelected = useMemo(() => {
    if (visible.length === 0) return false;
    for (const r of visible) {
      if (!selected.has(r.id)) return false;
    }
    return true;
  }, [visible, selected]);

  const totalProducts = useMemo(() => last?.total_products ?? 0, [last]);
  const totalDeficit = useMemo(() => last?.deficit_products ?? 0, [last]);
  const totalExpiring = useMemo(() => last?.expiring_products ?? 0, [last]);
  const totalUnmatched = useMemo(() => last?.unmatched_installs ?? 0, [last]);

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

  const toggleOne = useCallback(
    (id: number) => {
      if (!isAdmin) return;

      setSelected((prev) => {
        const next = new Set(prev);

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      });
    },
    [isAdmin]
  );

  const toggleAllVisible = useCallback(() => {
    if (!isAdmin) return;

    setSelected((prev) => {
      if (visible.length === 0) return prev;

      const next = new Set(prev);
      const every = visible.every((r) => next.has(r.id));

      if (every) {
        for (const r of visible) next.delete(r.id);
      } else {
        for (const r of visible) next.add(r.id);
      }

      return next;
    });
  }, [isAdmin, visible]);

  const invertSelection = useCallback(() => {
    setSelected((prev) => {
      const next = new Set<number>();

      for (const r of visible) {
        if (!prev.has(r.id)) next.add(r.id);
      }

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

    setErr(
      ok
        ? ""
        : "Не удалось скопировать в clipboard: браузер запретил доступ."
    );
  }, [last]);

  const deleteSelected = useCallback(async () => {
    if (!isAdmin) return;

    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const ok = await confirm.ask({
      title: `Удалить выбранные запуски: ${ids.length}?`,
      description: "Операция удалит выбранные записи из истории запусков.",
      confirmLabel: "Удалить",
      cancelLabel: "Отмена",
      danger: true,
    });

    if (!ok) return;

    setErr("");
    setBusy(true);

    try {
      const res = await deleteRunsBulk(ids);

      if (!(res as any)?.ok) {
        setErr((res as any)?.error ?? "Ошибка массового удаления.");
        return;
      }

      const idSet = new Set(ids);

      setRuns((prev) => prev.filter((r) => !idSet.has(r.id)));
      cancelSelectMode();

      const deleted = (res as any)?.deleted ?? ids.length;
      const notFound = (res as any)?.notFound ?? 0;

      if (notFound) {
        setErr(`Удалено: ${deleted}. Не найдено: ${notFound}.`);
      }
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
        title: `Удалить запуски старше ${days} дней?`,
        description: "Будут удалены записи истории, которые старше указанного периода.",
        confirmLabel: "Удалить",
        cancelLabel: "Отмена",
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
        title: `Оставить только последние ${keepLast}?`,
        description: "Остальные запуски будут удалены. Это действие нельзя отменить.",
        confirmLabel: "Применить",
        cancelLabel: "Отмена",
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
      title: "Удалить всю историю запусков?",
      description: "Будет удалена вся история проверок. Это действие нельзя отменить.",
      confirmLabel: "Удалить всё",
      cancelLabel: "Отмена",
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

      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <History className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="text-xl font-semibold text-slate-950">
                Журнал запусков проверок
              </div>

              <div className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                История выполнения анализа лицензий, результаты сопоставления
                и служебные действия по очистке журнала.
              </div>

              {last && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <CalendarClock className="h-4 w-4" />
                  <span>
                    Последний запуск:{" "}
                    <span className="font-semibold text-slate-800">
                      #{last.id}
                    </span>{" "}
                    · {last.run_at}
                  </span>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to="/imports"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Импорты
                    </Link>

                    <Link
                      to="/dictionaries/mapping"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Правила сопоставления
                    </Link>

                    <Link
                      to="/licenses"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Реестр лицензий
                    </Link>
                  </div>

                  <Link
                    to={`/runs/${last.id}`}
                    className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
                  >
                    Открыть
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
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
              <RefreshCw
                className={cn("h-4 w-4", refreshBusy && "animate-spin")}
              />
              Обновить
            </Button>

            {isAdmin && (
              <Button
                size="sm"
                onClick={() => void runAndOpen()}
                disabled={runBusy || busy}
              >
                <RefreshCw className={cn("h-4 w-4", runBusy && "animate-spin")} />
                {runBusy ? "Запуск..." : "Запустить проверку"}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!last) return;
                await onCopyLastId();
              }}
              disabled={!last || busy}
              title="Копировать ID последнего запуска"
            >
              <Copy className="h-4 w-4" />
              Копировать ID
            </Button>

            <button
              type="button"
              onClick={() =>
                void downloadProtectedFile(download.runsCsv, "license-monitor-runs.csv")
              }
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <DownloadIcon className="h-4 w-4" />
              Экспорт CSV
            </button>
            <span ref={menuAnchorRef} className="inline-flex">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMenuOpen((v) => !v)}
                title="Действия"
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
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <MenuSection title="Действия">
                  {isAdmin && (
                    <MenuItem
                      icon={<Trash2 className="h-4 w-4" />}
                      title="Удалить запуски..."
                      description="Включить режим выбора"
                      right={runs.length}
                      disabled={busy}
                      onClick={startSelectMode}
                      tone="danger"
                    />
                  )}

                  <MenuItem
                    icon={
                      <RefreshCw
                        className={cn(
                          "h-4 w-4",
                          refreshBusy && "animate-spin"
                        )}
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
                    icon={<DownloadIcon className="h-4 w-4" />}
                    title="Экспорт CSV"
                    description="Скачать историю запусков"
                    disabled={busy}
                    onClick={() => {
                      setMenuOpen(false);
                      void downloadProtectedFile(download.runsCsv, "license-monitor-runs.csv");
                    }}
                  />

                  <MenuItem
                    icon={<Copy className="h-4 w-4" />}
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
                        icon={<CalendarClock className="h-4 w-4" />}
                        title="Выбрать последние 10"
                        description="Из видимых 50"
                        disabled={busy}
                        onClick={() => withSelection(() => selectLastN(10))}
                      />

                      <MenuItem
                        icon={<ShieldAlert className="h-4 w-4" />}
                        title="Выбрать только рискованные"
                        description="Дефицит / истекают / несопоставленные"
                        right={riskyCount}
                        disabled={busy}
                        onClick={() => withSelection(selectRiskyOnly)}
                        tone="warn"
                      />

                      <MenuItem
                        icon={<Layers className="h-4 w-4" />}
                        title="Инвертировать выделение"
                        description="В пределах видимых 50"
                        disabled={busy}
                        onClick={() => withSelection(invertSelection)}
                      />

                      <MenuItem
                        icon={<Minus className="h-4 w-4" />}
                        title="Снять выделение"
                        description="Снять всё"
                        disabled={busy}
                        onClick={() => withSelection(clearSelection)}
                      />
                    </MenuSection>

                    <MenuDivider />

                    <MenuSection title="Очистка истории">
                      <MenuItem
                        icon={<TimerReset className="h-4 w-4" />}
                        title="Удалить старше 30 дней"
                        description="Очистка по возрасту"
                        disabled={busy}
                        onClick={() => doOlderThan(30)}
                        tone="warn"
                      />

                      <MenuItem
                        icon={<TimerReset className="h-4 w-4" />}
                        title="Удалить старше 90 дней"
                        description="Очистка по возрасту"
                        disabled={busy}
                        onClick={() => doOlderThan(90)}
                        tone="warn"
                      />

                      <MenuDivider />

                      <MenuItem
                        icon={<HardDrive className="h-4 w-4" />}
                        title="Оставить только последние 50"
                        description="Потребует ввод KEEP_LAST_50"
                        disabled={busy}
                        onClick={() => doKeepLast(50)}
                        tone="danger"
                      />

                      <MenuItem
                        icon={<HardDrive className="h-4 w-4" />}
                        title="Оставить только последние 200"
                        description="Потребует ввод KEEP_LAST_200"
                        disabled={busy}
                        onClick={() => doKeepLast(200)}
                        tone="danger"
                      />

                      <MenuDivider />

                      <MenuItem
                        icon={<Skull className="h-4 w-4" />}
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
                  icon={<X className="h-4 w-4" />}
                  title="Закрыть"
                  disabled={busy}
                  onClick={() => setMenuOpen(false)}
                />
              </div>
            </Dropdown>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Всего запусков" value={runs.length} />
        <StatCard
          label="Рискованные"
          value={riskyCount}
          tone={riskyCount ? "warn" : "ok"}
        />
        <StatCard label="Продукты" value={totalProducts} />
        <StatCard
          label="Дефицит"
          value={totalDeficit}
          tone={totalDeficit ? "bad" : "ok"}
        />
        <StatCard
          label="Истекают / несопоставленные"
          value={`${totalExpiring}/${totalUnmatched}`}
          tone={totalExpiring || totalUnmatched ? "warn" : "ok"}
        />
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-sm font-semibold text-red-700">Ошибка</div>
          <div className="mt-1 break-words text-xs text-red-600">{err}</div>
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableCaption
            title="История запусков"
            description="Сводка по последним проверкам и результатам сопоставления."
            right={
              isAdmin && selectMode ? (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-500">
                    Выбрано:{" "}
                    <span className="font-semibold text-slate-900">
                      {selected.size}
                    </span>
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy || selected.size === 0}
                    onClick={deleteSelected}
                    className="min-w-[160px]"
                    title={
                      selected.size === 0
                        ? "Ничего не выбрано"
                        : "Удалить выбранные"
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    {busy ? "Удаление..." : "Удалить выбранные"}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={cancelSelectMode}
                    title="Отменить выбор"
                  >
                    <X className="h-4 w-4" />
                    Отмена
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Последние 50
                </div>
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
                  ? "Запустите проверку лицензий — здесь появится история."
                  : "История запусков пока пуста."
              }
            />
          ) : (
            <TableScroll className="max-h-[60vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    {isAdmin && selectMode && (
                      <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left">
                        <button
                          onClick={toggleAllVisible}
                          className="inline-flex items-center gap-2 text-xs text-slate-600 transition hover:text-slate-950"
                          title={
                            allVisibleSelected
                              ? "Снять выделение"
                              : "Выбрать все видимые"
                          }
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
                      label="ID"
                      dir={sortKey === "id" ? sortDir : null}
                      onToggle={() => toggleSort("id", "asc")}
                      hint="Сортировать по идентификатору"
                    />
                    <SortTh
                      label="Дата запуска"
                      dir={sortKey === "run_at" ? sortDir : null}
                      onToggle={() => toggleSort("run_at", "desc")}
                      hint="Сортировать по дате запуска"
                    />
                    <SortTh
                      label="Продукты"
                      dir={sortKey === "total_products" ? sortDir : null}
                      onToggle={() => toggleSort("total_products", "desc")}
                      hint="Сортировать по количеству продуктов"
                    />
                    <SortTh
                      label="Дефицит"
                      dir={sortKey === "deficit_products" ? sortDir : null}
                      onToggle={() => toggleSort("deficit_products", "desc")}
                      hint="Сортировать по количеству дефицитов"
                    />
                    <SortTh
                      label="Истекают"
                      dir={sortKey === "expiring_products" ? sortDir : null}
                      onToggle={() => toggleSort("expiring_products", "desc")}
                      hint="Сортировать по количеству истекающих"
                    />
                    <SortTh
                      label="Несопоставленные"
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
                          "border-l-4",
                          risky ? "border-l-amber-400" : "border-l-transparent",
                          isAdmin && selectMode && checked && "bg-slate-100"
                        )}
                      >
                        {isAdmin && selectMode && (
                          <Td>
                            <button
                              onClick={() => toggleOne(r.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                              title={checked ? "Снять выбор" : "Выбрать"}
                              type="button"
                            >
                              {checked ? (
                                <CheckSquare className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </Td>
                        )}

                        <Td>
                          <div className="flex flex-col gap-1">
                            <Link
                              className="inline-flex items-center gap-2 font-semibold text-blue-600 hover:underline"
                              to={`/runs/${r.id}`}
                            >
                              #{r.id}
                              <span className="text-[11px] font-normal text-slate-400">
                                Детали
                              </span>
                            </Link>

                            <Link
                              to={`/runs/${r.id}/diff`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Сравнить
                            </Link>
                          </div>
                        </Td>

                        <Td className="text-slate-600">{r.run_at}</Td>
                        <Td className="tabular-nums text-slate-700">
                          {r.total_products}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums font-medium",
                            r.deficit_products
                              ? "text-red-700"
                              : "text-slate-600"
                          )}
                        >
                          {r.deficit_products}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums font-medium",
                            r.expiring_products
                              ? "text-amber-700"
                              : "text-slate-600"
                          )}
                        >
                          {r.expiring_products}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums font-medium",
                            r.unmatched_installs
                              ? "text-amber-700"
                              : "text-slate-600"
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