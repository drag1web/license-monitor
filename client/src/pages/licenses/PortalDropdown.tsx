import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../ui/cn/cn";

type Rect = { left: number; top: number; width: number; height: number; right: number; bottom: number };
function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function useOutsidePointerDown(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const root = ref.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) onClose();
    };
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true } as any);
  }, [open, onClose]);

  return ref;
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
  const rootRef = useOutsidePointerDown(open, onClose);
  useEsc(open, onClose);

  const panelRef = useRef<HTMLDivElement | null>(null);
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
    const y = fitsBelow ? belowY : clamp(aboveY, margin, vh - pr.height - margin);

    setPos({ x, y });
  }, [anchorRef]);

  useEffect(() => {
    if (!open) return;
    compute();
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
    <div ref={rootRef} className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0" aria-hidden />
      <div
        ref={(el) => {
          panelRef.current = el;
        }}
        style={{ width, transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
        className={cn(
          "absolute rounded-2xl border border-white/10 bg-[rgb(var(--panel))]/96",
          "backdrop-blur-sm shadow-[0_18px_50px_rgba(0,0,0,0.42)] overflow-hidden",
          "animate-[dropdownIn_120ms_ease-out] motion-reduce:animate-none"
        )}
        role="menu"
      >
        {children}
      </div>

      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translate3d(${pos.x}px, ${pos.y + 6}px, 0) scale(0.98); }
          to   { opacity: 1; transform: translate3d(${pos.x}px, ${pos.y}px, 0) scale(1); }
        }
      `}</style>
    </div>
  );
}

export function MenuItem({
  icon,
  title,
  description,
  right,
  tone,
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
        "w-full text-left px-3 py-2",
        "flex items-center gap-2",
        "hover:bg-white/5 transition",
        disabled && "opacity-50 cursor-not-allowed",
        tone === "danger" && "hover:bg-rose-500/10"
      )}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className={cn("text-sm font-semibold", tone === "danger" ? "text-rose-100" : "text-white/90")}>
          {title}
        </div>
        {description && <div className="text-[11px] text-white/45">{description}</div>}
      </div>
      {right != null && <div className="text-[11px] text-white/45 tabular-nums">{right}</div>}
    </button>
  );
}

export function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 pt-3 pb-2 text-[11px] text-white/45">{title}</div>
      {children}
    </div>
  );
}
