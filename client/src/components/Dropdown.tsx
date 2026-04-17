import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../ui/cn/cn";

type Rect = { left: number; top: number; width: number; height: number; right: number; bottom: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
}

// ✅ правильный outside: сравниваем НЕ с root (inset-0), а с PANEL
function useOutsidePointerDown(open: boolean, panelRef: React.RefObject<HTMLElement>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;

    const onDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;

      if (e.target instanceof Node && !panel.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true } as any);
  }, [open, panelRef, onClose]);
}

// ✅ блокируем фон-скролл, но даём скроллить сам dropdown
function useLockBodyScroll(open: boolean, panelRef: React.RefObject<HTMLElement>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const onWheel = (e: WheelEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.target instanceof Node && panel.contains(e.target)) return; // внутри меню — пусть скроллит
      e.preventDefault(); // фон не скроллим
    };

    const onTouchMove = (e: TouchEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.target instanceof Node && panel.contains(e.target)) return;
      e.preventDefault();
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false, capture: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel, { capture: true } as any);
      window.removeEventListener("touchmove", onTouchMove, { capture: true } as any);
    };
  }, [open, panelRef, onClose]);
}

type DropdownProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  width?: number | string;
  sideOffset?: number;
  align?: "start" | "end";
  className?: string;
  children: React.ReactNode;
};

export function Dropdown({
  open,
  onClose,
  anchorRef,
  width = 320,
  sideOffset = 10,
  align = "end",
  className,
  children,
}: DropdownProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // ✅ close on outside
  useOutsidePointerDown(open, panelRef as any, onClose);
  // ✅ lock background scroll + esc
  useLockBodyScroll(open, panelRef as any, onClose);

  const [pos, setPos] = useState<{ x: number; y: number; side: "bottom" | "top" }>(() => ({
    x: 0,
    y: 0,
    side: "bottom",
  }));

  const wStyle = useMemo(() => (typeof width === "number" ? `${width}px` : width), [width]);

  const compute = () => {
    const a = anchorRef.current;
    const p = panelRef.current;
    if (!a || !p) return;

    const ar = getRect(a);
    const pr = getRect(p);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 10;

    const desiredX = align === "start" ? ar.left : ar.right - pr.width;
    const x = clamp(desiredX, margin, vw - pr.width - margin);

    const belowY = ar.bottom + sideOffset;
    const aboveY = ar.top - sideOffset - pr.height;

    const fitsBelow = belowY + pr.height + margin <= vh;
    const fitsAbove = aboveY >= margin;

    let side: "bottom" | "top" = "bottom";
    let y = belowY;

    if (!fitsBelow && fitsAbove) {
      side = "top";
      y = aboveY;
    } else {
      y = clamp(belowY, margin, vh - pr.height - margin);
    }

    setPos({ x, y, side });
  };

  useLayoutEffect(() => {
    if (!open) return;
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wStyle, align, sideOffset]);

  useEffect(() => {
    if (!open) return;

    const onReflow = () => compute();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);

    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* ✅ клики по фону тоже закрывают */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close menu"
        onPointerDown={onClose}
      />

      <div
        ref={panelRef}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: wStyle,
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          maxHeight: "min(70vh, 520px)", // ✅ чтобы мог скроллиться и не душил окно
        }}
        className={cn(
          "absolute",
          "rounded-2xl border border-white/10 bg-[rgb(var(--panel))]/96",
          "backdrop-blur-sm",
          "shadow-[0_18px_50px_rgba(0,0,0,0.42)]",
          "overflow-auto", // ✅ если много пунктов — скролл внутри
          "will-change-transform",
          "origin-top-right",
          "animate-[dropdownIn_120ms_ease-out]",
          "motion-reduce:animate-none",
          className
        )}
        role="menu"
        aria-orientation="vertical"
        data-side={pos.side}
      >
        {children}
      </div>

      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translate3d(${pos.x}px, ${pos.y + 6}px, 0) scale(0.98); }
          to   { opacity: 1; transform: translate3d(${pos.x}px, ${pos.y}px, 0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}
