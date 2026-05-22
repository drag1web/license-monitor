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
import { CheckSquare, Plus, Sparkles, Square, ShieldAlert } from "lucide-react";
import type { Density, SortDir, SortKey } from "./types";
import { LicenseRow } from "./LicenseRow";

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
        Демо-данные
      </Button>
      <Button size="sm" onClick={onOpenAdd}>
        <Plus className="h-4 w-4" />
        Добавить лицензию
      </Button>
    </div>
  );

  const scrollFx = disableEffectsWhileScroll && scrolling;

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableCaption
          title="Реестр лицензий"
          description={
            compact
              ? "Компактный режим: только ключевые признаки."
              : "Обычный режим: больше контекста, примечания и удобное чтение."
          }
          right={
            <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
              <ShieldAlert className="h-4 w-4 text-slate-400" />
              <span>
                {loading ? "…" : `Показано: ${sorted.length} / Всего: ${rowsCount}`}
              </span>
            </div>
          }
        />

        {loading ? (
          <TableSkeleton rows={8} cols={cols} />
        ) : sorted.length === 0 ? (
          <TableEmpty
            title="Пока нет лицензий"
            description="Добавьте записи в реестр или загрузите демо-данные."
            action={emptyRight}
          />
        ) : (
          <TableScroll
            onScroll={onScroll}
            data-scrolling={scrollFx ? "1" : "0"}
            className={cn(
              "max-h-[70vh]",
              disableEffectsWhileScroll && "data-[scrolling=1]:[&_tr]:transition-none"
            )}
          >
            <TableInner stickyHeader={stickyHeader} density={density} fixedLayout>
              <colgroup>
                {selectMode && <col className="w-[72px]" />}
                <col className="w-[25%]" />
                {showVendor && <col className="w-[13%]" />}
                {showType && <col className="w-[11%]" />}
                <col className="w-[220px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[136px]" />
              </colgroup>
              <THead>
                <tr>
                  {selectMode && (
                    <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left">
                      <button
                        type="button"
                        onClick={onToggleAllVisible}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                        title={allVisibleSelected ? "Снять выделение" : "Выбрать всё"}
                      >
                        {allVisibleSelected ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                        <span className="hidden md:inline">Все</span>
                      </button>
                    </th>
                  )}

                  <SortTh
                    label="Продукт"
                    dir={sortKey === "product" ? sortDir : null}
                    onToggle={() => onToggleSort("product")}
                  />

                  {showVendor && (
                    <SortTh
                      label="Производитель"
                      dir={sortKey === "vendor" ? sortDir : null}
                      onToggle={() => onToggleSort("vendor")}
                    />
                  )}

                  {showType && (
                    <SortTh
                      label="Тип"
                      dir={sortKey === "type" ? sortDir : null}
                      onToggle={() => onToggleSort("type")}
                    />
                  )}

                  <SortTh
                    label="Использовано / всего"
                    dir={sortKey === "seats" ? sortDir : null}
                    onToggle={() => onToggleSort("seats")}
                  />

                  <SortTh
                    label="Срок"
                    dir={sortKey === "expires" ? sortDir : null}
                    onToggle={() => onToggleSort("expires")}
                  />

                  <SortTh
                    label="Статус"
                    dir={sortKey === "status" ? sortDir : null}
                    onToggle={() => onToggleSort("status")}
                  />

                  <th className="border-b border-slate-200 bg-slate-50 py-3 pl-3 pr-5 text-right text-xs font-semibold text-slate-600">
                    Действия
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
          </TableScroll>
        )}
      </Table>
    </Card>
  );
}