import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "../cn/cn";
import { Button } from "../Button";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requireText?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  overlayClassName?: string;
  panelClassName?: string;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
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
        if (!requireText || value === requireText) onConfirm();
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
      <button
        type="button"
        aria-label="Закрыть окно"
        onClick={onCancel}
        className={cn(
          "absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]",
          overlayClassName
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          "absolute left-1/2 top-1/2 w-[min(520px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2",
          "rounded-2xl border border-slate-300 bg-white p-6",
          "shadow-[0_18px_60px_rgba(15,23,42,0.22)]",
          panelClassName
        )}
      >
        <div className="flex gap-4">
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-xl border",
              danger
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-slate-200 bg-slate-50 text-slate-600"
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Подтверждение действия
            </div>

            <div className="mt-1 text-lg font-semibold text-slate-950">
              {title}
            </div>

            {description && (
              <div className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </div>
            )}
          </div>
        </div>

        {requireText && (
          <div className="mt-5">
            <div className="text-sm text-slate-600">
              Введите:{" "}
              <span className="font-semibold text-slate-950">
                {requireText}
              </span>
            </div>

            <input
              ref={inputRef}
              value={value}
              onChange={(e) => onValueChange?.(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              placeholder={requireText}
              spellCheck={false}
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>

          <Button
            variant={danger ? "danger" : "primary"}
            size="sm"
            disabled={busy || !canConfirm}
            onClick={onConfirm}
            className="min-w-[140px]"
          >
            {busy ? "Выполняется..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}