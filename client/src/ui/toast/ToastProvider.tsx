import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../cn/cn";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastItem = {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
  duration?: number; // ms
  action?: ToastAction;
};

type ToastContextValue = {
  push: (t: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const LIMIT = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const timers = React.useRef(new Map<string, number>());

  const dismiss = React.useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const clear = React.useCallback(() => {
    for (const [, t] of timers.current) window.clearTimeout(t);
    timers.current.clear();
    setItems([]);
  }, []);

  const push = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = uid();
      const duration = t.duration ?? (t.tone === "error" ? 5200 : 3600);

      setItems((prev) => {
        const next = [{ ...t, id }, ...prev];
        return next.slice(0, LIMIT);
      });

      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  // cleanup on unmount
  React.useEffect(() => clear, [clear]);

  const value: ToastContextValue = React.useMemo(
    () => ({ push, dismiss, clear }),
    [push, dismiss, clear]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast() must be used inside <ToastProvider />");
  }
  return ctx;
}

/* ------------------------------------------
 *  Viewport
 * ------------------------------------------ */

function toneTokens(tone: ToastTone) {
  switch (tone) {
    case "success":
      return {
        ring: "ring-emerald-300/15",
        border: "border-emerald-300/20",
        glow: "shadow-[0_16px_70px_rgba(16,185,129,0.18)]",
        pill: "bg-emerald-500/12 text-emerald-100 border-emerald-300/20",
        Icon: CheckCircle2,
      };
    case "warning":
      return {
        ring: "ring-amber-300/15",
        border: "border-amber-300/20",
        glow: "shadow-[0_16px_70px_rgba(245,158,11,0.18)]",
        pill: "bg-amber-500/12 text-amber-100 border-amber-300/20",
        Icon: AlertTriangle,
      };
    case "error":
      return {
        ring: "ring-rose-300/15",
        border: "border-rose-300/20",
        glow: "shadow-[0_16px_70px_rgba(244,63,94,0.18)]",
        pill: "bg-rose-500/12 text-rose-100 border-rose-300/20",
        Icon: XCircle,
      };
    default:
      return {
        ring: "ring-cyan-300/15",
        border: "border-cyan-300/20",
        glow: "shadow-[0_16px_70px_rgba(34,211,238,0.16)]",
        pill: "bg-cyan-500/12 text-cyan-100 border-cyan-300/20",
        Icon: Info,
      };
  }
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[9999]",
        "right-4 bottom-4",
        "w-[360px] max-w-[calc(100vw-32px)]"
      )}
    >
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const tok = toneTokens(item.tone);
  const Icon = tok.Icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn("pointer-events-auto mb-2")}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "border",
          tok.border,
          tok.glow,
          "bg-slate-950/55 backdrop-blur-xl",
          "ring-1 ring-white/[0.06]",
          tok.ring
        )}
      >
        {/* top glow line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {/* subtle blob */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/5 blur-2xl" />

        <div className="p-3.5 flex gap-3">
          <div
            className={cn(
              "h-10 w-10 shrink-0 rounded-2xl grid place-items-center",
              "border",
              tok.border,
              tok.pill
            )}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            {item.title && (
              <div className="text-sm font-semibold text-white/90 leading-tight">
                {item.title}
              </div>
            )}
            <div className="mt-0.5 text-[12px] text-white/60 leading-relaxed break-words">
              {item.message}
            </div>

            {item.action && (
              <div className="mt-2">
                <button
                  className={cn(
                    "inline-flex items-center justify-center",
                    "rounded-xl px-3 py-1.5 text-[12px] font-semibold",
                    "bg-white/[0.05] border border-white/[0.10]",
                    "hover:bg-white/[0.08] hover:border-white/[0.14]",
                    "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                  )}
                  onClick={() => item.action?.onClick()}
                >
                  {item.action.label}
                </button>
              </div>
            )}
          </div>

          <button
            className={cn(
              "h-8 w-8 shrink-0 rounded-xl grid place-items-center",
              "text-white/55 hover:text-white/85",
              "hover:bg-white/[0.06] transition",
              "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
            )}
            onClick={() => onDismiss(item.id)}
            aria-label="close toast"
            title="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
