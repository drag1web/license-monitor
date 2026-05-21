import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../ui/cn/cn";

type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    right: r.right,
    bottom: r.bottom,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useOutsidePointerDown(
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    if (!open) return;

    const onDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;

      if (e.target instanceof Node && !panel.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open, onClose, panelRef]);
}

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

export function PortalDropdown({
  open,
  onClose,
  anchorRef,
  width = 240,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  width?: number;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useOutsidePointerDown(open, onClose, panelRef);
  useEsc(open, onClose);

  const [pos, setPos] = useState({ x: 0, y: 0 });

  const compute = useCallback(() => {
    const a = anchorRef.current;
    const p = panelRef.current;
    if (!a || !p) return;

    const ar = getRect(a);
    const pr = getRect(p);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 10;

    const desiredX = ar.right - pr.width;
    const x = clamp(desiredX, margin, vw - pr.width - margin);

    const belowY = ar.bottom + 8;
    const aboveY = ar.top - 8 - pr.height;
    const fitsBelow = belowY + pr.height + margin <= vh;
    const y = fitsBelow
      ? belowY
      : clamp(aboveY, margin, vh - pr.height - margin);

    setPos({ x, y });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;

    requestAnimationFrame(compute);

    const onRe = () => compute();

    window.addEventListener("resize", onRe);
    window.addEventListener("scroll", onRe, true);

    return () => {
      window.removeEventListener("resize", onRe);
      window.removeEventListener("scroll", onRe, true);
    };
  }, [open, compute]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0" aria-hidden />

      <div
        ref={(el) => {
          panelRef.current = el;
        }}
        style={{
          width,
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        }}
        className={cn(
          "absolute overflow-hidden rounded-xl",
          "border border-slate-200 bg-white",
          "shadow-[0_18px_50px_rgba(15,23,42,0.22)]"
        )}
        role="menu"
      >
        {children}
      </div>
    </div>
  );
}

export function MenuItem({
  icon,
  title,
  description,
  right,
  tone = "default",
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  right?: React.ReactNode;
  tone?: "default" | "warn" | "danger";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
        "hover:bg-slate-50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger" && "hover:bg-red-50"
      )}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "text-sm font-semibold",
            tone === "danger"
              ? "text-red-700"
              : tone === "warn"
                ? "text-amber-700"
                : "text-slate-900"
          )}
        >
          {title}
        </div>

        {description && (
          <div className="mt-0.5 text-xs leading-4 text-slate-500">
            {description}
          </div>
        )}
      </div>

      {right != null && (
        <div className="text-xs tabular-nums text-slate-400">{right}</div>
      )}
    </button>
  );
}

export function MenuSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      {children}
    </div>
  );
}