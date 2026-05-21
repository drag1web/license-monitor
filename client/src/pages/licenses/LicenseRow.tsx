import type { LicenseRow as Row } from "../../api";
import { cn } from "../../ui/cn/cn";
import { Button } from "../../ui/Button";
import { Tr, Td } from "../../ui/Table";
import {
  CheckSquare,
  Square,
  Pin,
  PinOff,
  MoreHorizontal,
  Pencil,
  CalendarClock,
  Building2,
  Tags,
} from "lucide-react";

import type { Density } from "./types";
import { safeNum, toneFromSeats, statusTone, formatExpires } from "./utils";

export function LicenseRow({
  row,
  density,
  selectMode,
  checked,
  onToggleChecked,
  pinned,
  onTogglePin,
  showVendor,
  showType,
  showNote,
  editingSeatsId,
  tmpUsed,
  tmpTotal,
  setTmpUsed,
  setTmpTotal,
  onBeginSeatsEdit,
  onCancelSeatsEdit,
  onCommitSeatsEdit,
  onOpenEditRow,
  onOpenMenu,
}: {
  row: Row;
  density: Density;
  selectMode: boolean;
  checked: boolean;
  onToggleChecked: () => void;
  pinned: boolean;
  onTogglePin: () => void;
  showVendor: boolean;
  showType: boolean;
  showNote: boolean;
  editingSeatsId: string | null;
  tmpUsed: number;
  tmpTotal: number;
  setTmpUsed: (n: number) => void;
  setTmpTotal: (n: number) => void;
  onBeginSeatsEdit: () => void;
  onCancelSeatsEdit: () => void;
  onCommitSeatsEdit: () => void;
  onOpenEditRow: () => void;
  onOpenMenu: (anchor: HTMLElement) => void;
}) {
  const compact = density === "compact";

  const seatsUsed = safeNum(row.seats_used);
  const seatsTotal = safeNum(row.seats_total);

  const seatsTone = toneFromSeats(seatsUsed, seatsTotal);
  const exp = formatExpires(row.expires_at ?? null);

  const st = statusTone(row);
  const statusLabel = st === "bad" ? "Риск" : st === "warn" ? "Внимание" : "Норма";
  const isEditingSeats = editingSeatsId === row.id;

  const tdPad = compact ? "py-2" : "py-3";
  const subText = compact ? "text-[10px]" : "text-[11px]";
  const showComfortNote = !compact && showNote && row.note;

  const statusDotCls =
    st === "bad"
      ? "bg-red-600"
      : st === "warn"
        ? "bg-amber-500"
        : "bg-emerald-600";

  const statusPillCls =
    st === "bad"
      ? "border-red-200 bg-red-50 text-red-700"
      : st === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  const seatsPillCls =
    seatsTone === "bad"
      ? "border-red-200 bg-red-50 text-red-700"
      : seatsTone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  const inputCls = cn(
    "rounded-lg border border-slate-300 bg-white text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100",
    compact ? "w-16 px-2 py-1" : "w-20 px-3 py-1.5"
  );

  const actionBtn =
    "grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950";

  const metaChip = cn(
    "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600",
    subText
  );

  return (
    <Tr
      className={cn(
        "group border-l-4",
        pinned ? "border-l-blue-500" : "border-l-transparent",
        checked && "bg-blue-50",
        compact && "text-[13px]"
      )}
    >
      {selectMode && (
        <Td className={tdPad}>
          <button
            type="button"
            onClick={onToggleChecked}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
            title={checked ? "Снять выбор" : "Выбрать"}
          >
            {checked ? (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
        </Td>
      )}

      <Td className={tdPad}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              onClick={onOpenEditRow}
              className={cn(
                "truncate text-left font-semibold text-slate-900 transition hover:text-blue-600 hover:underline",
                compact ? "text-[13px]" : "text-[14px]"
              )}
              title="Редактировать"
            >
              {row.product}
            </button>

            {pinned && (
              <span className={cn("mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700", subText)}>
                <Pin className="h-3.5 w-3.5" />
                закреплено
              </span>
            )}
          </div>

          {!compact && (showVendor || showType) && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {showVendor && row.vendor && (
                <span className={metaChip}>
                  <Building2 className="h-3.5 w-3.5" />
                  {row.vendor}
                </span>
              )}

              {showType && row.license_type && (
                <span className={metaChip}>
                  <Tags className="h-3.5 w-3.5" />
                  {row.license_type}
                </span>
              )}
            </div>
          )}

          {showComfortNote && (
            <div className="mt-1.5 max-w-[62ch] truncate text-xs text-slate-500">
              {row.note}
            </div>
          )}
        </div>
      </Td>

      {showVendor && (
        <Td className={cn(tdPad, "text-slate-700")}>
          {compact ? row.vendor ?? "—" : <span className="truncate">{row.vendor ?? "—"}</span>}
        </Td>
      )}

      {showType && (
        <Td className={cn(tdPad, "text-slate-700")}>
          {row.license_type || "—"}
        </Td>
      )}

      <Td className={cn(tdPad, "tabular-nums")}>
        {!isEditingSeats ? (
          <button
            type="button"
            onClick={onBeginSeatsEdit}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 transition hover:bg-slate-50",
              seatsPillCls,
              compact && "px-2.5 py-1"
            )}
            title="Изменить количество мест"
          >
            <span className="font-semibold">{seatsUsed}/{seatsTotal}</span>

            {compact ? (
              <Pencil className="h-3.5 w-3.5 opacity-60" />
            ) : (
              <span className={cn("opacity-60", subText)}>изменить</span>
            )}
          </button>
        ) : (
          <div className={cn("flex items-center gap-2", compact && "gap-1.5")}>
            <input
              className={inputCls}
              type="number"
              value={tmpUsed}
              onChange={(e) => setTmpUsed(safeNum(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancelSeatsEdit();
                if (e.key === "Enter") onCommitSeatsEdit();
              }}
              autoFocus
            />

            <span className="text-slate-400">/</span>

            <input
              className={inputCls}
              type="number"
              value={tmpTotal}
              onChange={(e) => setTmpTotal(safeNum(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancelSeatsEdit();
                if (e.key === "Enter") onCommitSeatsEdit();
              }}
            />

            <Button variant="ghost" size="sm" onClick={onCommitSeatsEdit}>
              Сохранить
            </Button>

            <Button variant="ghost" size="sm" onClick={onCancelSeatsEdit}>
              Отмена
            </Button>
          </div>
        )}
      </Td>

      <Td
        className={cn(
          tdPad,
          exp.tone === "bad"
            ? "text-red-700"
            : exp.tone === "warn"
              ? "text-amber-700"
              : "text-slate-700"
        )}
      >
        <div className={cn("flex items-center gap-2", compact && "gap-1.5")}>
          {!compact && <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />}

          <div className="min-w-0">
            <div className="font-medium">{exp.text}</div>
            {!compact && exp.hint && (
              <div className={cn("mt-0.5 text-slate-500", subText)}>
                {exp.hint}
              </div>
            )}
          </div>
        </div>
      </Td>

      <Td className={tdPad}>
        {compact ? (
          <span title={statusLabel} className={cn("inline-flex h-2.5 w-2.5 rounded-full", statusDotCls)} />
        ) : (
          <span className={cn("inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium", statusPillCls)}>
            <span className={cn("inline-flex h-2.5 w-2.5 rounded-full", statusDotCls)} />
            {statusLabel}
          </span>
        )}
      </Td>

      <Td className={cn(tdPad, "text-right")}>
        <div className={cn("inline-flex items-center gap-2", compact && "gap-1.5")}>
          <button
            type="button"
            className={cn(actionBtn, pinned && "border-blue-200 bg-blue-50 text-blue-700")}
            onClick={onTogglePin}
            title={pinned ? "Открепить" : "Закрепить"}
          >
            {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </button>

          <button
            type="button"
            className={actionBtn}
            onClick={(e) => onOpenMenu(e.currentTarget)}
            title="Ещё"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </Td>
    </Tr>
  );
}