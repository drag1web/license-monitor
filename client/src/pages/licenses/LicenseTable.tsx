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
import { CheckSquare, Plus, Sparkles, Square } from "lucide-react";
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
    // turn on immediately
    setScrolling(true);

    // debounce off
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
    // approximate for skeleton; doesn't need to be perfect, just consistent
    // base columns: product, seats, expires, status, actions
    let n = 5;
    if (selectMode) n += 1;
    if (showVendor) n += 1;
    if (showType) n += 1;
    if (showNote) n += 0; // note is usually inside product row, keep skeleton stable
    return n;
  }, [selectMode, showVendor, showType, showNote]);

  const emptyRight = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={onSeedDemo}>
        <Sparkles className="h-4 w-4" />
        Seed demo
      </Button>
      <Button variant="primary" size="sm" onClick={onOpenAdd}>
        <Plus className="h-4 w-4" />
        Add
      </Button>
    </div>
  );

  const scrollFx = disableEffectsWhileScroll && scrolling;

  return (
    <Card
      className={cn(
        S.tableCard,
        // isolate paints inside this card (helps Electron/Chromium)
        "[contain:paint]"
      )}
    >
      <Table>
        <TableCaption
          title="Licenses"
          description={
            compact
              ? "Compact view: focuses on signals (status dot, no note/hints)."
              : "Comfort view: full context (notes + expiry hints)."
          }
          right={
            <div className="text-[11px] text-white/45 tabular-nums">
              {loading ? "…" : `Показано: ${sorted.length} / Всего: ${rowsCount}`}
            </div>
          }
        />

        {loading ? (
          <TableSkeleton rows={8} cols={cols} />
        ) : sorted.length === 0 ? (
          <TableEmpty
            title="Пока нет лицензий"
            description="Добавь записи в реестр или закинь демо-данные — чтобы увидеть все фичи."
            action={emptyRight}
          />
        ) : (
          <TableScroll
            onScroll={onScroll}
            data-scrolling={scrollFx ? "1" : "0"}
            className={cn(
              "max-h-[70vh]",
              "[contain:paint]",
              /**
               * While scrolling we disable heavy effects:
               * - transitions
               * - row shine after pseudo element
               *
               * NOTE: We rely on LicenseRow using S.rowShine (with ::after)
               */
              disableEffectsWhileScroll && "data-[scrolling=1]:[&_tr]:transition-none",
              disableEffectsWhileScroll && "data-[scrolling=1]:[&_tr]:after:opacity-0"
            )}
          >
            <TableInner stickyHeader={stickyHeader} density={density}>
              <THead>
                <tr
                  className={cn(
                    "border-b border-white/[0.08]",
                    "bg-[rgb(var(--panel))]/95",
                    "shadow-[0_1px_0_rgba(255,255,255,0.06)]",
                    compact ? "[&_th]:py-2" : "[&_th]:py-2.5"
                  )}
                >
                  {selectMode && (
                    <th className="px-3 text-left">
                      <button
                        type="button"
                        onClick={onToggleAllVisible}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5",
                          "border border-white/[0.08] bg-white/[0.02]",
                          "text-xs text-white/65 hover:text-white/85 hover:bg-white/[0.05] transition"
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

                  <th className="px-3 text-right text-xs text-white/35">actions</th>
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

            <div className="pointer-events-none sticky bottom-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
          </TableScroll>
        )}
      </Table>
    </Card>
  );
}
