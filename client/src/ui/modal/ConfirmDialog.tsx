import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../cn/cn";
import { Button } from "../Button";

type Props = {
  open: boolean;
  title: string;
  description?: string;

  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;

  /** Если задано — нужно ввести эту фразу, иначе Confirm disabled */
  requireText?: string;
  value?: string;
  onValueChange?: (v: string) => void;

  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;

  /** Можно кастомизировать фон */
  overlayClassName?: string;
  panelClassName?: string;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  requireText,
  value = "",
  onValueChange,
  busy,
  onCancel,
  onConfirm,
  overlayClassName,
  panelClassName,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") {
        if (requireText) {
          if (value === requireText) onConfirm();
        } else {
          onConfirm();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    queueMicrotask(() => inputRef.current?.focus());

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel, onConfirm, requireText, value]);

  if (!open) return null;

  const canConfirm = requireText ? value === requireText : true;

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      {/* OVERLAY / BACKDROP */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onCancel}
        className={cn(
          "absolute inset-0",
          // ✅ вот этот фон — чтобы не сливалось
          "bg-black/60",
          // ✅ лёгкая виньетка/градиент, выглядит богаче
          "bg-[radial-gradient(1200px_600px_at_50%_20%,rgba(0,255,255,0.08),transparent_55%),radial-gradient(900px_500px_at_20%_80%,rgba(255,0,128,0.06),transparent_55%)]",
          "backdrop-blur-[2px]",
          overlayClassName
        )}
      />

      {/* PANEL */}
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-[min(560px,calc(100vw-24px))]",
          "rounded-[28px] border border-white/10",
          "bg-[rgb(var(--panel))]/98",
          "shadow-[0_30px_90px_rgba(0,0,0,0.60)]",
          "p-5",
          "outline-none",
          panelClassName
        )}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-white/55">Confirmation</div>
            <div className="mt-1 text-lg font-semibold text-white/90">{title}</div>
            {description && <div className="mt-2 text-sm text-white/60">{description}</div>}
          </div>
        </div>

        {requireText && (
          <div className="mt-4">
            <div className="text-xs text-white/50">
              Type: <span className="text-white/80 font-semibold">{requireText}</span>
            </div>
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => onValueChange?.(e.target.value)}
              className={cn(
                "mt-2 w-full rounded-2xl border border-white/10 bg-black/25",
                "px-3 py-2 text-sm text-white/85 outline-none",
                "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
              )}
              placeholder={requireText}
              spellCheck={false}
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>

          <Button
            variant={danger ? "danger" : "primary"}
            size="sm"
            disabled={busy || !canConfirm}
            onClick={onConfirm}
            className="min-w-[140px] justify-center"
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
