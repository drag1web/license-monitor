import { CheckSquare, Layers, Minus, ShieldAlert, Square, Trash2 } from "lucide-react";
import { Button } from "../../ui/Button";
import type { Density } from "./types";

export function BulkBar({
  selectedCount,
  allVisibleSelected,
  riskyCountVisible,
  bulkBusy,
  onToggleAllVisible,
  onInvert,
  onRiskyOnly,
  onClear,
  onBulkDelete,
}: {
  selectedCount: number;
  allVisibleSelected: boolean;
  riskyCountVisible: number;
  bulkBusy: boolean;
  onToggleAllVisible: () => void;
  onInvert: () => void;
  onRiskyOnly: () => void;
  onClear: () => void;
  onBulkDelete: () => void;
  density?: Density;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <CheckSquare className="h-4 w-4 text-slate-500" />
        Выбрано:{" "}
        <span className="font-semibold tabular-nums text-slate-950">
          {selectedCount}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onToggleAllVisible} disabled={bulkBusy}>
          {allVisibleSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
          {allVisibleSelected ? "Снять всё" : "Выбрать всё"}
        </Button>

        <Button variant="ghost" size="sm" onClick={onInvert} disabled={bulkBusy}>
          <Layers className="h-4 w-4" />
          Инвертировать
        </Button>

        <Button variant="ghost" size="sm" onClick={onRiskyOnly} disabled={bulkBusy}>
          <ShieldAlert className="h-4 w-4" />
          Рисковые ({riskyCountVisible})
        </Button>

        <Button variant="ghost" size="sm" onClick={onClear} disabled={bulkBusy}>
          <Minus className="h-4 w-4" />
          Очистить
        </Button>

        <Button
          variant="danger"
          size="sm"
          onClick={onBulkDelete}
          disabled={bulkBusy || selectedCount === 0}
          className="min-w-[160px]"
        >
          <Trash2 className="h-4 w-4" />
          {bulkBusy ? "Удаление..." : "Удалить выбранные"}
        </Button>
      </div>
    </div>
  );
}