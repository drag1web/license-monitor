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
} from "lucide-react";

import type { Density } from "./types";
import { S } from "./styles";
import {
  safeNum,
  toneFromSeats,
  statusTone,
  formatExpires,
  pill,
} from "./utils";

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

  const seatsT = toneFromSeats(safeNum(row.seats_used), safeNum(row.seats_total));
  const exp = formatExpires(row.expires_at ?? null);

  const st = statusTone(row);
  const statusLabel = st === "bad" ? "RISK" : st === "warn" ? "WATCH" : "OK";

  const isEditingSeats = editingSeatsId === row.id;

  const tdPad = compact ? "py-2" : "py-3";
  const subText = compact ? "text-[10px]" : "text-[11px]";
  const noteText = compact ? "hidden" : "block"; // note only in comfort

  const seatsBtn = cn(
    "inline-flex items-center gap-2 rounded-2xl border",
    "bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.05] transition",
    compact ? "px-2.5 py-1" : "px-3 py-1.5",
    seatsT === "bad"
      ? "text-rose-200"
      : seatsT === "warn"
        ? "text-amber-200"
        : "text-white/80"
  );

  const inputCls = cn(
    "rounded-2xl border text-sm",
    "bg-white/[0.03] border-white/[0.10] text-white/85",
    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25",
    compact ? "w-16 px-2.5 py-1" : "w-20 px-3 py-1.5"
  );

  const actionBtn = cn(
    S.tinyBtn,
    compact && "h-9 w-9 rounded-xl",
    // in compact: actions are quieter until hover
    compact && "opacity-40 group-hover:opacity-100 transition-opacity"
  );

  const statusDot = cn(
    "inline-flex h-2.5 w-2.5 rounded-full",
    st === "bad"
      ? "bg-rose-200 shadow-[0_0_14px_rgba(251,113,133,0.35)]"
      : st === "warn"
        ? "bg-amber-200 shadow-[0_0_14px_rgba(253,230,138,0.25)]"
        : "bg-emerald-200 shadow-[0_0_14px_rgba(110,231,183,0.25)]"
  );

  return (
    <Tr
      data-rowshine="1"
      data-scrl-fx="1"
      className={cn(
        "group",
        S.rowShine,
        pinned && "shadow-[inset_3px_0_0_rgba(34,211,238,0.32)]",
        compact && "text-[13px]"
      )}
    >
      {selectMode && (
        <Td className={tdPad}>
          <button
            type="button"
            onClick={onToggleChecked}
            className={cn(
              "inline-flex items-center justify-center rounded-xl hover:bg-white/5 transition",
              compact ? "h-8 w-8" : "h-8 w-8"
            )}
            title={checked ? "Unselect" : "Select"}
          >
            {checked ? (
              <CheckSquare className="h-4 w-4 text-cyan-200" />
            ) : (
              <Square className="h-4 w-4 text-white/50" />
            )}
          </button>
        </Td>
      )}

      {/* Product + note */}
      <Td className={tdPad}>
        <div className="flex items-start gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenEditRow}
            className={cn(S.productBtn, compact && "text-[13px]")}
            title="Edit"
          >
            {row.product}
          </button>

          {pinned && (
            <span
              className={cn(
                "mt-0.5 inline-flex items-center gap-1 text-cyan-200/80",
                subText
              )}
            >
              <Pin className="h-3.5 w-3.5" />
              pinned
            </span>
          )}
        </div>

        {showNote && row.note && (
          <div className={cn("mt-0.5 text-[12px] text-white/45 truncate max-w-[56ch]", noteText)}>
            {row.note}
          </div>
        )}
      </Td>

      {showVendor && <Td className={cn(tdPad, "text-white/65")}>{row.vendor ?? "—"}</Td>}
      {showType && <Td className={cn(tdPad, "text-white/70")}>{row.license_type}</Td>}

      {/* Seats inline edit */}
      <Td className={cn(tdPad, "tabular-nums")}>
        {!isEditingSeats ? (
          <button type="button" onClick={onBeginSeatsEdit} className={seatsBtn} title="Click to edit seats">
            <span className="font-semibold">
              {safeNum(row.seats_used)}/{safeNum(row.seats_total)}
            </span>

            {compact ? (
              <Pencil className="h-3.5 w-3.5 text-white/40" />
            ) : (
              <span className={cn("text-white/35", subText)}>edit</span>
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
            <span className="text-white/35">/</span>
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

            <Button
              variant="ghost"
              size="sm"
              onClick={onCommitSeatsEdit}
              className={cn("px-3", compact && "h-8 px-2.5 rounded-xl")}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelSeatsEdit}
              className={cn("px-3", compact && "h-8 px-2.5 rounded-xl")}
            >
              Cancel
            </Button>
          </div>
        )}
      </Td>

      {/* Expires */}
      <Td
        className={cn(
          tdPad,
          "text-white/70",
          exp.tone === "bad"
            ? "text-rose-200 font-semibold"
            : exp.tone === "warn"
              ? "text-amber-200 font-semibold"
              : ""
        )}
      >
        <div className={cn("flex items-center gap-2", compact && "gap-1.5")}>
          <span>{exp.text}</span>
          {/* hint только в comfort */}
          {!compact && exp.hint && <span className={cn("text-white/40", subText)}>{exp.hint}</span>}
        </div>
      </Td>

      {/* Status */}
      <Td className={tdPad}>
        {compact ? (
          <span className={statusDot} title={statusLabel} />
        ) : (
          <span className={pill(st)}>
            <span className={cn("h-2 w-2 rounded-full", statusDot)} />
            {statusLabel}
          </span>
        )}
      </Td>

      {/* Actions */}
      <Td className={cn(tdPad, "text-right")}>
        <div className={cn("inline-flex items-center gap-2", compact && "gap-1.5")}>
          <button
            type="button"
            className={cn(actionBtn, pinned && "border-cyan-300/20 bg-cyan-500/10")}
            onClick={onTogglePin}
            title={pinned ? "Unpin" : "Pin"}
          >
            {pinned ? (
              <PinOff className="h-4 w-4 text-cyan-200/80" />
            ) : (
              <Pin className="h-4 w-4 text-white/70" />
            )}
          </button>

          <button
            type="button"
            className={actionBtn}
            onClick={(e) => onOpenMenu(e.currentTarget)}
            title="More"
          >
            <MoreHorizontal className="h-4 w-4 text-white/70" />
          </button>
        </div>
      </Td>
    </Tr>
  );
}
