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
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 text-sm text-white/70">
        <CheckSquare className="h-4 w-4 text-white/50" />
        Selected: <span className="font-semibold text-white/85 tabular-nums">{selectedCount}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onToggleAllVisible} disabled={bulkBusy}>
          {allVisibleSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
          {allVisibleSelected ? "Unselect all" : "Select all"}
        </Button>

        <Button variant="ghost" size="sm" onClick={onInvert} disabled={bulkBusy}>
          <Layers className="h-4 w-4" />
          Invert
        </Button>

        <Button variant="ghost" size="sm" onClick={onRiskyOnly} disabled={bulkBusy}>
          <ShieldAlert className="h-4 w-4" />
          Risky only ({riskyCountVisible})
        </Button>

        <Button variant="ghost" size="sm" onClick={onClear} disabled={bulkBusy}>
          <Minus className="h-4 w-4" />
          Clear
        </Button>

        <Button
          variant="danger"
          size="sm"
          onClick={onBulkDelete}
          disabled={bulkBusy || selectedCount === 0}
          className="min-w-[180px] justify-center"
          title={selectedCount === 0 ? "Nothing selected" : "Delete selected"}
        >
          <Trash2 className="h-4 w-4" />
          {bulkBusy ? "Deleting…" : "Delete selected"}
        </Button>
      </div>
    </div>
  );
}
