import React, { useEffect, useMemo, useState } from "react";
import { Minus, Square, X, MonitorDot } from "lucide-react";
import { cn } from "../ui/cn/cn";

type TopBarProps = {
  title?: string;
  subtitle?: string;
  showAppIcon?: boolean;
  rightSlot?: React.ReactNode;
};

const DRAG_STYLE = { WebkitAppRegion: "drag" } as React.CSSProperties;
const NODRAG_STYLE = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

function useWindowMaximized(pollMs = 800) {
  const [max, setMax] = useState(false);

  async function refresh() {
    const v = await window.electron?.window.isMaximized?.();
    if (typeof v === "boolean") setMax(v);
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { max, refresh };
}

/** маленькая “живая” точка статуса */
function Dot() {
  return (
    <span
      className={cn(
        "relative inline-block h-1.5 w-1.5 rounded-full",
        "bg-cyan-300/90",
        "shadow-[0_0_14px_rgba(34,211,238,0.55)]",
        "after:absolute after:inset-0 after:rounded-full after:content-['']",
        "after:bg-cyan-300/60 after:blur-md after:opacity-70",
        // микро “пульс” без keyframes: через transition + scale на hover группы
        "transition-transform duration-300 group-hover:scale-[1.25]"
      )}
    />
  );
}

export function TopBar({
  title = "License Monitor",
  subtitle = "Realtime dashboard",
  showAppIcon = true,
  rightSlot,
}: TopBarProps) {
  const { max, refresh } = useWindowMaximized(800);
  const MaxIcon = useMemo(() => Square, []);
  const maximizeTitle = max ? "Restore" : "Maximize";

  const root = cn(
    "group sticky top-0 z-50 select-none",
    // base glass
    "bg-slate-950/55 backdrop-blur-2xl",
    // subtle gradient film
    "bg-[radial-gradient(120%_140%_at_15%_0%,rgba(34,211,238,0.18)_0%,transparent_55%),radial-gradient(120%_140%_at_70%_0%,rgba(99,102,241,0.18)_0%,transparent_55%),linear-gradient(to_bottom,rgba(2,6,23,0.70),rgba(2,6,23,0.45),rgba(2,6,23,0.25))]",
    // borders
    "border-b border-white/10",
    // crisp top inner highlight
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
    // transform perf
    "relative isolate overflow-hidden"
  );

  const wrap = "h-12 px-3 flex items-center gap-3";

  const titleCls = cn(
    "text-sm font-semibold tracking-[0.02em]",
    "text-transparent bg-clip-text",
    "bg-gradient-to-r from-white/95 via-white/75 to-white/55"
  );

  const subtitleCls = cn(
    "text-[11px] leading-none text-white/45 tracking-wide",
    "flex items-center gap-2"
  );

  const windowBtnBase = cn(
    "group/btn relative h-8 w-10 grid place-items-center rounded-xl",
    "transition-[transform,background,border,box-shadow,filter] duration-250 ease-out",
    "outline-none active:scale-[0.975]",
    // surface
    "bg-white/[0.035] border border-white/[0.07]",
    "shadow-[0_10px_28px_rgba(0,0,0,0.45)]",
    // hover polish
    "hover:bg-white/[0.07] hover:border-white/[0.12]",
    "hover:-translate-y-[1px]",
    // focus
    "focus-visible:ring-2 focus-visible:ring-cyan-300/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
    // tiny sheen inside
    "before:absolute before:inset-0 before:rounded-xl before:content-['']",
    "before:bg-gradient-to-b before:from-white/[0.10] before:to-transparent",
    "before:opacity-0 before:transition-opacity before:duration-300",
    "hover:before:opacity-100"
  );

  const windowBtnIcon = cn(
    "text-white/80",
    "transition-transform duration-250 ease-out",
    "group-hover/btn:scale-[1.06]"
  );

  const closeBtn = cn(
    windowBtnBase,
    "hover:bg-rose-500/15 hover:border-rose-400/25",
    "focus-visible:ring-rose-400/25",
    // агрессивный glow у close на hover
    "hover:shadow-[0_16px_45px_-18px_rgba(244,63,94,0.85)]"
  );

  return (
    <div className={root} style={DRAG_STYLE}>
      {/* Animated glow “film” (без keyframes: двигаем на hover) */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-x-24 -top-20 h-40",
          "bg-[radial-gradient(closest-side,rgba(34,211,238,0.28),transparent_70%)]",
          "blur-2xl opacity-70",
          "translate-x-[-6%] transition-transform duration-700 ease-out",
          "group-hover:translate-x-[10%]"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -inset-x-24 -top-24 h-44",
          "bg-[radial-gradient(closest-side,rgba(99,102,241,0.24),transparent_72%)]",
          "blur-2xl opacity-70",
          "translate-x-[8%] transition-transform duration-700 ease-out",
          "group-hover:translate-x-[-8%]"
        )}
      />

      {/* top glow line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />

      {/* “shine sweep” */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 -left-1/3 w-1/3",
          "bg-gradient-to-r from-transparent via-white/[0.10] to-transparent",
          "skew-x-[-18deg]",
          "opacity-0 transition-all duration-700 ease-out",
          "group-hover:opacity-100 group-hover:left-[120%]"
        )}
      />

      {/* subtle bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-black/25" />

      <div className={wrap}>
        {/* left: app mark */}
        {showAppIcon && (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "group/logo relative h-8 w-8 rounded-2xl grid place-items-center",
                "bg-white/[0.04] border border-white/[0.09]",
                "shadow-[0_12px_34px_rgba(0,0,0,0.45)]",
                "transition-transform duration-300 ease-out",
                "hover:-translate-y-[1px] hover:shadow-[0_20px_55px_-30px_rgba(34,211,238,0.65)]",
                // внешнее сияние
                "before:absolute before:inset-[-2px] before:rounded-[calc(theme(borderRadius.2xl)+2px)] before:content-['']",
                "before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100",
                "before:bg-[conic-gradient(from_180deg,rgba(34,211,238,0.55),rgba(99,102,241,0.55),rgba(236,72,153,0.40),rgba(34,211,238,0.55))]",
                "before:blur-xl",
                // внутренний глянец
                "after:absolute after:inset-[1px] after:rounded-[calc(theme(borderRadius.2xl)-1px)] after:content-['']",
                "after:bg-gradient-to-b after:from-white/[0.12] after:to-white/[0.02]"
              )}
              style={NODRAG_STYLE}
              title="App"
            >
              <MonitorDot className="relative z-10 h-4 w-4 text-cyan-200/85" />
            </div>
          </div>
        )}

        {/* center: title */}
        <div className="flex flex-col justify-center">
          <div className={titleCls}>{title}</div>
          <div className={subtitleCls}>
            <Dot />
            <span>{subtitle}</span>
          </div>
        </div>

        {/* right: custom slot + window controls */}
        <div className="ml-auto flex items-center gap-2" style={NODRAG_STYLE}>
          {rightSlot && (
            <div
              className={cn(
                "mr-1 flex items-center gap-2 rounded-2xl px-2 py-1",
                "bg-white/[0.025] border border-white/[0.06]",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
                "hover:bg-white/[0.045] hover:border-white/[0.10]",
                "transition-[background,border,box-shadow] duration-300"
              )}
            >
              {rightSlot}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              className={cn(windowBtnBase, windowBtnIcon)}
              onClick={() => window.electron?.window.minimize?.()}
              title="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>

            <button
              className={cn(windowBtnBase, windowBtnIcon)}
              onClick={async () => {
                await window.electron?.window.maximize?.();
                await refresh();
              }}
              title={maximizeTitle}
            >
              <MaxIcon className="h-3.5 w-3.5" />
            </button>

            <button
              className={cn(closeBtn, windowBtnIcon)}
              onClick={() => window.electron?.window.close?.()}
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
