import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LicenseRow as Row } from "../../api";
import { Card } from "../../ui/Card";
import {
  Table,
  TableCaption,
  TableEmpty,
  TableInner,
  TableScroll,
  TableSkeleton,
  TBody,
  THead,
  SortTh,
} from "../../ui/Table";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn/cn";
import {
  CheckSquare,
  Plus,
  Sparkles,
  Square,
  ShieldAlert,
} from "lucide-react";
import { S } from "./styles";
import type { Density, SortDir, SortKey } from "./types";
import { LicenseRow } from "./LicenseRow";

/**
 * Marks "scrolling=true" for a short time after any scroll event.
 * Used to disable expensive hover/after effects during scroll → smoother FPS.
 */
function useIsScrolling(delay = 140) {
  const [scrolling, setScrolling] = useState(false);
  const tRef = useRef<number | null>(null);

  const onScroll = useCallback(() => {
    setScrolling(true);

    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      setScrolling(false);
      tRef.current = null;
    }, delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, []);

  return { scrolling, onScroll };
}

type Props = {
  loading: boolean;
  rowsCount: number;
  sorted: Row[];
  density: Density;

  stickyHeader: boolean;
  disableEffectsWhileScroll?: boolean;

  selectMode: boolean;
  selected: Set<string>;
  allVisibleSelected: boolean;
  onToggleAllVisible: () => void;
  onToggleOne: (id: string) => void;

  showVendor: boolean;
  showType: boolean;
  showNote: boolean;

  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (k: SortKey) => void;

  pinned: Set<string>;
  onTogglePin: (id: string) => void;

  editingSeatsId: string | null;
  tmpUsed: number;
  tmpTotal: number;
  setTmpUsed: (n: number) => void;
  setTmpTotal: (n: number) => void;
  onBeginSeatsEdit: (row: Row) => void;
  onCancelSeatsEdit: () => void;
  onCommitSeatsEdit: (row: Row) => void;

  onOpenEditRow: (row: Row) => void;
  onOpenRowMenu: (row: Row, anchor: HTMLElement) => void;

  onSeedDemo: () => void;
  onOpenAdd: () => void;
};

export function LicenseTable({
  loading,
  rowsCount,
  sorted,
  density,

  stickyHeader,
  disableEffectsWhileScroll = true,

  selectMode,
  selected,
  allVisibleSelected,
  onToggleAllVisible,
  onToggleOne,

  showVendor,
  showType,
  showNote,

  sortKey,
  sortDir,
  onToggleSort,

  pinned,
  onTogglePin,

  editingSeatsId,
  tmpUsed,
  tmpTotal,
  setTmpUsed,
  setTmpTotal,
  onBeginSeatsEdit,
  onCancelSeatsEdit,
  onCommitSeatsEdit,

  onOpenEditRow,
  onOpenRowMenu,

  onSeedDemo,
  onOpenAdd,
}: Props) {
  const compact = density === "compact";
  const { scrolling, onScroll } = useIsScrolling(140);

  const cols = useMemo(() => {
    let n = 5;
    if (selectMode) n += 1;
    if (showVendor) n += 1;
    if (showType) n += 1;
    return n;
  }, [selectMode, showVendor, showType]);

  const emptyRight = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onSeedDemo}>
        <Sparkles className="h-4 w-4" />
        Seed demo
      </Button>
      <Button variant="primary" size="sm" onClick={onOpenAdd}>
        <Plus className="h-4 w-4" />
        Add license
      </Button>
    </div>
  );

  const scrollFx = disableEffectsWhileScroll && scrolling;

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-3xl",
        "bg-[linear-gradient(to_bottom,rgba(var(--bg),0.72),rgba(var(--bg),0.34))]",
        "shadow-[0_24px_80px_rgba(0,0,0,0.34)]",
        "[contain:paint]",
        S.tableCard
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/16 to-transparent" />
      <div className="pointer-events-none absolute -left-16 top-0 h-48 w-48 rounded-full bg-cyan-500/6 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-indigo-500/6 blur-3xl" />

      <Table>
        <TableCaption
          title="Licenses"
          description={
            compact
              ? "Compact view: focuses on the key signals."
              : "Comfort view: more context, notes and better scanning."
          }
          right={
            <div className="flex items-center gap-2 text-[11px] text-[rgba(var(--fg),0.45)] tabular-nums">
              <ShieldAlert className="h-3.5 w-3.5 text-[rgba(var(--fg),0.34)]" />
              <span>{loading ? "…" : `Показано: ${sorted.length} / Всего: ${rowsCount}`}</span>
            </div>
          }
        />

        {loading ? (
          <div className="px-4 pb-4">
            <div
              className={cn(
                "overflow-hidden rounded-[24px] border",
                "border-[rgba(100,130,170,0.14)]",
                "bg-[rgba(var(--card),0.12)]"
              )}
            >
              <TableSkeleton rows={8} cols={cols} />
            </div>
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-4 pb-4">
            <div
              className={cn(
                "rounded-[24px] border p-6",
                "border-[rgba(100,130,170,0.14)]",
                "bg-[linear-gradient(to_bottom,rgba(var(--card),0.16),rgba(var(--card),0.08))]"
              )}
            >
              <TableEmpty
                title="Пока нет лицензий"
                description="Добавь записи в реестр или закинь демо-данные — чтобы увидеть все сценарии, фильтры и статусы."
                action={emptyRight}
              />
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div
              className={cn(
                "overflow-hidden rounded-[24px] border",
                "border-[rgba(100,130,170,0.14)]",
                "bg-[rgba(var(--card),0.10)]"
              )}
            >
              <TableScroll
                onScroll={onScroll}
                data-scrolling={scrollFx ? "1" : "0"}
                className={cn(
                  "max-h-[70vh]",
                  "[contain:paint]",
                  disableEffectsWhileScroll && "data-[scrolling=1]:[&_tr]:transition-none",
                  disableEffectsWhileScroll && "data-[scrolling=1]:[&_tr]:after:opacity-0"
                )}
              >
                <TableInner stickyHeader={stickyHeader} density={density}>
                  <THead>
                    <tr
                      className={cn(
                        "border-b border-[rgba(100,130,170,0.14)]",
                        "bg-[linear-gradient(to_bottom,rgba(var(--card),0.26),rgba(var(--card),0.14))]",
                        "shadow-[inset_0_-1px_0_rgba(255,255,255,0.02)]",
                        compact ? "[&_th]:py-2" : "[&_th]:py-2.5",
                        "[&_th:first-child]:rounded-tl-[18px]",
                        "[&_th:last-child]:rounded-tr-[18px]",
                        "[&_th]:overflow-hidden"
                      )}
                    >
                      {selectMode && (
                        <th className="px-3 text-left">
                          <button
                            type="button"
                            onClick={onToggleAllVisible}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5",
                              "border border-[rgba(100,130,170,0.14)]",
                              "bg-[rgba(var(--card),0.14)]",
                              "text-xs text-[rgba(var(--fg),0.65)] transition",
                              "hover:bg-[rgba(var(--card),0.24)] hover:text-[rgba(var(--fg),0.88)]"
                            )}
                            title={allVisibleSelected ? "Unselect all" : "Select all"}
                          >
                            {allVisibleSelected ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                            <span className="hidden md:inline">all</span>
                          </button>
                        </th>
                      )}

                      <SortTh
                        label="product"
                        dir={sortKey === "product" ? sortDir : null}
                        onToggle={() => onToggleSort("product")}
                        hint="Sort by product"
                      />

                      {showVendor && (
                        <SortTh
                          label="vendor"
                          dir={sortKey === "vendor" ? sortDir : null}
                          onToggle={() => onToggleSort("vendor")}
                          hint="Sort by vendor"
                        />
                      )}

                      {showType && (
                        <SortTh
                          label="type"
                          dir={sortKey === "type" ? sortDir : null}
                          onToggle={() => onToggleSort("type")}
                          hint="Sort by type"
                        />
                      )}

                      <SortTh
                        label="used/total"
                        dir={sortKey === "seats" ? sortDir : null}
                        onToggle={() => onToggleSort("seats")}
                        hint="Sort by seats utilization"
                      />

                      <SortTh
                        label="expires"
                        dir={sortKey === "expires" ? sortDir : null}
                        onToggle={() => onToggleSort("expires")}
                        hint="Sort by expiry"
                      />

                      <SortTh
                        label="status"
                        dir={sortKey === "status" ? sortDir : null}
                        onToggle={() => onToggleSort("status")}
                        hint="Sort by status"
                      />

                      <th className="px-3 text-right text-xs font-medium text-[rgba(var(--fg),0.32)]">
                        actions
                      </th>
                    </tr>
                  </THead>

                  <TBody>
                    {sorted.map((x) => {
                      const isPinned = pinned.has(x.id);
                      const checked = selected.has(x.id);

                      return (
                        <LicenseRow
                          key={x.id}
                          row={x}
                          density={density}
                          selectMode={selectMode}
                          checked={checked}
                          onToggleChecked={() => onToggleOne(x.id)}
                          pinned={isPinned}
                          onTogglePin={() => onTogglePin(x.id)}
                          showVendor={showVendor}
                          showType={showType}
                          showNote={showNote}
                          editingSeatsId={editingSeatsId}
                          tmpUsed={tmpUsed}
                          tmpTotal={tmpTotal}
                          setTmpUsed={setTmpUsed}
                          setTmpTotal={setTmpTotal}
                          onBeginSeatsEdit={() => onBeginSeatsEdit(x)}
                          onCancelSeatsEdit={onCancelSeatsEdit}
                          onCommitSeatsEdit={() => onCommitSeatsEdit(x)}
                          onOpenEditRow={() => onOpenEditRow(x)}
                          onOpenMenu={(anchor) => onOpenRowMenu(x, anchor)}
                        />
                      );
                    })}
                  </TBody>
                </TableInner>

                <div className="pointer-events-none sticky bottom-0 h-12 bg-gradient-to-t from-black/28 via-black/10 to-transparent" />
              </TableScroll>
            </div>
          </div>
        )}
      </Table>
    </Card>
  );
}