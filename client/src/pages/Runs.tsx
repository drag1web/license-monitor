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
 * Menu UI bits
 * ------------------------------------------ */

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="px-3 pt-3 pb-2 text-[11px] text-white/45">{title}</div>
      {children}
    </>
  );
}

function MenuDivider() {
  return <div className="h-px bg-white/10" />;
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
    disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5"
  );

  const titleCls =
    tone === "danger"
      ? "text-rose-100"
      : tone === "warn"
        ? "text-amber-100"
        : "text-white/90";

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
          {description && <div className="text-[11px] text-white/45">{description}</div>}
        </div>
        {right && <div className="ml-auto text-[11px] text-white/40">{right}</div>}
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
        {description && <div className="text-[11px] text-white/45">{description}</div>}
      </div>
      {right && <div className="ml-auto text-[11px] text-white/40">{right}</div>}
    </button>
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
    <Card className="p-5">
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
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-sm font-semibold text-white/85">Режим просмотра</div>
          <div className="mt-1 text-xs text-white/55">
            У вас нет прав на удаление и очистку истории запусков.
          </div>
        </div>
      )}

      <div className="flex items-end justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="text-xs text-white/55">История</div>
          <h3 className="text-xl font-semibold text-white/90 tracking-[0.01em]">Запуски</h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-white/45">{loading ? "…" : `Всего: ${runs.length}`}</div>

          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={refreshBusy || busy}
            className="px-2"
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", refreshBusy && "animate-spin")} />
          </Button>

          <span ref={menuAnchorRef} className="inline-flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen((v) => !v)}
              className="px-2"
              title="Options"
              disabled={busy}
            >
              <Menu className="h-4 w-4" />
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
            <MenuSection title="Actions">
              {isAdmin && (
                <MenuItem
                  icon={<Trash2 className="h-4 w-4 text-rose-200/90" />}
                  title="Delete runs…"
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
                title="Refresh"
                description="Перезагрузить список запусков"
                disabled={refreshBusy || busy}
                onClick={async () => {
                  setMenuOpen(false);
                  await refresh();
                }}
              />

              <MenuItem
                icon={<DownloadIcon className="h-4 w-4 text-cyan-200/80" />}
                title="Export runs.csv"
                description="Скачать историю запусков"
                href={download.runsCsv}
                disabled={busy}
                onClick={() => setMenuOpen(false)}
              />

              <MenuItem
                icon={<Copy className="h-4 w-4 text-cyan-200/80" />}
                title="Copy last run id"
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

                <MenuSection title="Selection tools">
                  <MenuItem
                    icon={<CalendarClock className="h-4 w-4 text-white/65" />}
                    title="Select last 10"
                    description="Из видимых 50"
                    disabled={busy}
                    onClick={() => withSelection(() => selectLastN(10))}
                  />

                  <MenuItem
                    icon={<ShieldAlert className="h-4 w-4 text-amber-200/80" />}
                    title="Select risky only"
                    description="deficit/expiring/unmatched"
                    right={riskyCount}
                    disabled={busy}
                    onClick={() => withSelection(selectRiskyOnly)}
                    tone="warn"
                  />

                  <MenuItem
                    icon={<Layers className="h-4 w-4 text-white/65" />}
                    title="Invert selection"
                    description="В пределах видимых 50"
                    disabled={busy}
                    onClick={() => withSelection(invertSelection)}
                  />

                  <MenuItem
                    icon={<Minus className="h-4 w-4 text-white/65" />}
                    title="Clear selection"
                    description="Снять всё"
                    disabled={busy}
                    onClick={() => withSelection(clearSelection)}
                  />
                </MenuSection>

                <MenuDivider />

                <MenuSection title="Retention">
                  <MenuItem
                    icon={<TimerReset className="h-4 w-4 text-amber-200/80" />}
                    title="Delete older than 30 days"
                    description="Очистка по возрасту"
                    disabled={busy}
                    onClick={() => doOlderThan(30)}
                    tone="warn"
                  />
                  <MenuItem
                    icon={<TimerReset className="h-4 w-4 text-amber-200/80" />}
                    title="Delete older than 90 days"
                    description="Очистка по возрасту"
                    disabled={busy}
                    onClick={() => doOlderThan(90)}
                    tone="warn"
                  />

                  <MenuDivider />

                  <MenuItem
                    icon={<HardDrive className="h-4 w-4 text-rose-200/90" />}
                    title="Keep only last 50"
                    description="Потребует ввод KEEP_LAST_50"
                    disabled={busy}
                    onClick={() => doKeepLast(50)}
                    tone="danger"
                  />
                  <MenuItem
                    icon={<HardDrive className="h-4 w-4 text-rose-200/90" />}
                    title="Keep only last 200"
                    description="Потребует ввод KEEP_LAST_200"
                    disabled={busy}
                    onClick={() => doKeepLast(200)}
                    tone="danger"
                  />

                  <MenuDivider />

                  <MenuItem
                    icon={<Skull className="h-4 w-4 text-rose-200/90" />}
                    title="Delete ALL runs"
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
              icon={<X className="h-4 w-4 text-white/60" />}
              title="Close"
              disabled={busy}
              onClick={() => setMenuOpen(false)}
            />
          </Dropdown>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
          <div className="text-sm font-semibold text-rose-100">Ошибка</div>
          <div className="mt-1 text-xs text-rose-200/80 break-words">{err}</div>
        </div>
      )}

      <Table>
        <TableCaption
          title="Запуски"
          description="Сводка по последним проверкам и результатам сопоставления."
          right={
            isAdmin && selectMode ? (
              <div className="flex items-center gap-2">
                <div className="text-[11px] text-white/45">
                  Selected: <span className="text-white/80">{selected.size}</span>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy || selected.size === 0}
                  onClick={deleteSelected}
                  className="min-w-[160px] justify-center"
                  title={selected.size === 0 ? "Nothing selected" : "Delete selected"}
                >
                  <Trash2 className="h-4 w-4" />
                  {busy ? "Deleting…" : "Delete selected"}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={cancelSelectMode}
                  title="Cancel selection mode"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="text-[11px] text-white/45">Последние 50</div>
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
                          "text-xs text-white/60 hover:text-white/80 transition-colors"
                        )}
                        title={allVisibleSelected ? "Unselect all" : "Select all (visible)"}
                        type="button"
                      >
                        {allVisibleSelected ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">all</span>
                      </button>
                    </th>
                  )}

                  <SortTh
                    label="id"
                    dir={sortKey === "id" ? sortDir : null}
                    onToggle={() => toggleSort("id", "asc")}
                    hint="Sort by id"
                  />
                  <SortTh
                    label="run_at"
                    dir={sortKey === "run_at" ? sortDir : null}
                    onToggle={() => toggleSort("run_at", "desc")}
                    hint="Sort by run time"
                  />
                  <SortTh
                    label="products"
                    dir={sortKey === "total_products" ? sortDir : null}
                    onToggle={() => toggleSort("total_products", "desc")}
                    hint="Sort by total products"
                  />
                  <SortTh
                    label="deficit"
                    dir={sortKey === "deficit_products" ? sortDir : null}
                    onToggle={() => toggleSort("deficit_products", "desc")}
                    hint="Sort by deficits"
                  />
                  <SortTh
                    label="expiring"
                    dir={sortKey === "expiring_products" ? sortDir : null}
                    onToggle={() => toggleSort("expiring_products", "desc")}
                    hint="Sort by expiring"
                  />
                  <SortTh
                    label="unmatched"
                    dir={sortKey === "unmatched_installs" ? sortDir : null}
                    onToggle={() => toggleSort("unmatched_installs", "desc")}
                    hint="Sort by unmatched installs"
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
                        isAdmin && selectMode && checked && "bg-white/[0.03]",
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
                              "hover:bg-white/5 transition-colors"
                            )}
                            title={checked ? "Unselect" : "Select"}
                            type="button"
                          >
                            {checked ? (
                              <CheckSquare className="h-4 w-4 text-cyan-200" />
                            ) : (
                              <Square className="h-4 w-4 text-white/50" />
                            )}
                          </button>
                        </Td>
                      )}

                      <Td>
                        <Link
                          className={cn(
                            "inline-flex items-center gap-2",
                            "text-cyan-200/90 hover:text-cyan-200",
                            "hover:underline underline-offset-4",
                            "font-semibold"
                          )}
                          to={`/runs/${r.id}`}
                        >
                          #{r.id}
                          <span className="text-[11px] font-normal text-white/35">Детали</span>
                        </Link>
                      </Td>

                      <Td className="text-white/70">{r.run_at}</Td>
                      <Td className="tabular-nums">{r.total_products}</Td>

                      <Td
                        className={cn(
                          "tabular-nums",
                          r.deficit_products ? "text-rose-200" : "text-white/75"
                        )}
                      >
                        {r.deficit_products}
                      </Td>

                      <Td
                        className={cn(
                          "tabular-nums",
                          r.expiring_products ? "text-amber-200" : "text-white/75"
                        )}
                      >
                        {r.expiring_products}
                      </Td>

                      <Td
                        className={cn(
                          "tabular-nums",
                          r.unmatched_installs ? "text-amber-200" : "text-white/75"
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
  );
}