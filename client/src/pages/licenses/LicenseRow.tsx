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

  const seatsUsed = safeNum(row.seats_used);
  const seatsTotal = safeNum(row.seats_total);

  const seatsTone = toneFromSeats(seatsUsed, seatsTotal);
  const exp = formatExpires(row.expires_at ?? null);

  const st = statusTone(row);
  const statusLabel = st === "bad" ? "RISK" : st === "warn" ? "WATCH" : "OK";

  const isEditingSeats = editingSeatsId === row.id;

  const tdPad = compact ? "py-2" : "py-3";
  const subText = compact ? "text-[10px]" : "text-[11px]";
  const showComfortNote = !compact && showNote && row.note;

  const statusDotCls =
    st === "bad"
      ? "bg-rose-200 shadow-[0_0_14px_rgba(251,113,133,0.35)]"
      : st === "warn"
        ? "bg-amber-200 shadow-[0_0_14px_rgba(253,230,138,0.25)]"
        : "bg-emerald-200 shadow-[0_0_14px_rgba(110,231,183,0.25)]";

  const statusDot = (
    <span className={cn("inline-flex h-2.5 w-2.5 rounded-full", statusDotCls)} />
  );

  const seatsBtn = cn(
    "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 transition",
    "bg-[rgba(var(--card),0.18)] hover:bg-[rgba(var(--card),0.28)]",
    compact && "px-2.5 py-1",
    seatsTone === "bad"
      ? "text-rose-200"
      : seatsTone === "warn"
        ? "text-amber-200"
        : "text-[rgba(var(--fg),0.82)]"
  );

  const seatsBadgeCls =
    seatsTone === "bad"
      ? "bg-rose-500/10 text-rose-100"
      : seatsTone === "warn"
        ? "bg-amber-500/10 text-amber-100"
        : "bg-[rgba(var(--card),0.24)] text-[rgba(var(--fg),0.76)]";

  const inputCls = cn(
    "rounded-2xl text-sm",
    "bg-[rgba(var(--card),0.22)] text-[rgba(var(--fg),0.88)]",
    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25",
    compact ? "w-16 px-2.5 py-1" : "w-20 px-3 py-1.5"
  );

  const actionBtn = cn(
    S.tinyBtn,
    "bg-[rgba(var(--card),0.14)] hover:bg-[rgba(var(--card),0.26)]",
    compact && "h-9 w-9 rounded-xl opacity-45 group-hover:opacity-100 transition-opacity"
  );

  const metaChip = cn(
    "inline-flex items-center gap-1.5 rounded-xl px-2 py-1",
    "bg-[rgba(var(--card),0.18)] text-[rgba(var(--fg),0.56)]",
    subText
  );

  return (
    <Tr
      data-rowshine="1"
      data-scrl-fx="1"
      className={cn(
        "group",
        S.rowShine,
        pinned && "shadow-[inset_3px_0_0_rgba(34,211,238,0.26)]",
        compact && "text-[13px]"
      )}
    >
      {selectMode && (
        <Td className={tdPad}>
          <button
            type="button"
            onClick={onToggleChecked}
            className={cn(
              "inline-flex items-center justify-center rounded-xl transition",
              "hover:bg-[rgba(var(--card),0.22)]",
              "h-8 w-8"
            )}
            title={checked ? "Unselect" : "Select"}
          >
            {checked ? (
              <CheckSquare className="h-4 w-4 text-cyan-300" />
            ) : (
              <Square className="h-4 w-4 text-[rgba(var(--fg),0.46)]" />
            )}
          </button>
        </Td>
      )}

      {/* PRODUCT / META / NOTE */}
      <Td className={tdPad}>
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              onClick={onOpenEditRow}
              className={cn(
                "truncate text-left font-semibold text-[rgba(var(--fg),0.90)] transition",
                "hover:text-cyan-200",
                compact ? "text-[13px]" : "text-[14px]"
              )}
              title="Edit"
            >
              {row.product}
            </button>

            {pinned && (
              <span
                className={cn(
                  "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-xl px-2 py-1",
                  "bg-cyan-500/10 text-cyan-200/85",
                  subText
                )}
              >
                <Pin className="h-3.5 w-3.5" />
                pinned
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
            <div className="mt-1.5 max-w-[62ch] truncate text-[12px] text-[rgba(var(--fg),0.46)]">
              {row.note}
            </div>
          )}
        </div>
      </Td>

      {showVendor && (
        <Td className={cn(tdPad, "text-[rgba(var(--fg),0.66)]")}>
          {compact ? row.vendor ?? "—" : <span className="truncate">{row.vendor ?? "—"}</span>}
        </Td>
      )}

      {showType && (
        <Td className={cn(tdPad, "text-[rgba(var(--fg),0.72)]")}>
          {row.license_type || "—"}
        </Td>
      )}

      {/* SEATS */}
      <Td className={cn(tdPad, "tabular-nums")}>
        {!isEditingSeats ? (
          <button
            type="button"
            onClick={onBeginSeatsEdit}
            className={seatsBtn}
            title="Click to edit seats"
          >
            <span
              className={cn(
                "rounded-xl px-2.5 py-1 font-semibold",
                seatsBadgeCls
              )}
            >
              {seatsUsed}/{seatsTotal}
            </span>

            {compact ? (
              <Pencil className="h-3.5 w-3.5 text-[rgba(var(--fg),0.40)]" />
            ) : (
              <span className={cn("text-[rgba(var(--fg),0.36)]", subText)}>edit</span>
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

            <span className="text-[rgba(var(--fg),0.35)]">/</span>

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
              className={cn("px-3", compact && "h-8 rounded-xl px-2.5")}
            >
              Save
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelSeatsEdit}
              className={cn("px-3", compact && "h-8 rounded-xl px-2.5")}
            >
              Cancel
            </Button>
          </div>
        )}
      </Td>

      {/* EXPIRES */}
      <Td
        className={cn(
          tdPad,
          exp.tone === "bad"
            ? "text-rose-200"
            : exp.tone === "warn"
              ? "text-amber-200"
              : "text-[rgba(var(--fg),0.74)]"
        )}
      >
        <div className={cn("flex items-center gap-2", compact && "gap-1.5")}>
          {!compact && (
            <CalendarClock className="h-4 w-4 shrink-0 text-[rgba(var(--fg),0.34)]" />
          )}

          <div className="min-w-0">
            <div className="font-medium">{exp.text}</div>
            {!compact && exp.hint && (
              <div className={cn("mt-0.5 text-[rgba(var(--fg),0.40)]", subText)}>
                {exp.hint}
              </div>
            )}
          </div>
        </div>
      </Td>

      {/* STATUS */}
      <Td className={tdPad}>
        {compact ? (
          <span title={statusLabel}>{statusDot}</span>
        ) : (
          <span className={pill(st)}>
            {statusDot}
            {statusLabel}
          </span>
        )}
      </Td>

      {/* ACTIONS */}
      <Td className={cn(tdPad, "text-right")}>
        <div className={cn("inline-flex items-center gap-2", compact && "gap-1.5")}>
          <button
            type="button"
            className={cn(
              actionBtn,
              pinned && "bg-cyan-500/10"
            )}
            onClick={onTogglePin}
            title={pinned ? "Unpin" : "Pin"}
          >
            {pinned ? (
              <PinOff className="h-4 w-4 text-cyan-200/85" />
            ) : (
              <Pin className="h-4 w-4 text-[rgba(var(--fg),0.70)]" />
            )}
          </button>

          <button
            type="button"
            className={actionBtn}
            onClick={(e) => onOpenMenu(e.currentTarget)}
            title="More"
          >
            <MoreHorizontal className="h-4 w-4 text-[rgba(var(--fg),0.70)]" />
          </button>
        </div>
      </Td>
    </Tr>
  );
}