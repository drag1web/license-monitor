import React, { useEffect, useMemo, useState } from "react";
import { Minus, Square, X } from "lucide-react";

type TopBarProps = {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

const DRAG_STYLE = { WebkitAppRegion: "drag" } as React.CSSProperties;
const NODRAG_STYLE = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

function useWindowMaximized(pollMs = 800) {
  const [max, setMax] = useState(false);

  async function refresh() {
    const v = await window.electron?.window?.isMaximized?.();
    if (typeof v === "boolean") setMax(v);
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
  }, []);

  return { max, refresh };
}

export function TopBar({
  title = "License Monitor",
  subtitle = "Система мониторинга лицензирования ПО",
  rightSlot,
}: TopBarProps) {
  const { max, refresh } = useWindowMaximized(800);
  const MaxIcon = useMemo(() => Square, []);
  const maximizeTitle = max ? "Восстановить" : "Развернуть";

  return (
    <header
      className="sticky top-0 z-50 flex h-12 select-none items-center border-b border-slate-200 bg-white px-3"
      style={DRAG_STYLE}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div>
          <div className="text-sm font-semibold leading-none text-slate-950">
            {title}
          </div>
          <div className="mt-1 text-[11px] leading-none text-slate-500">
            {subtitle}
          </div>
        </div>
      </div>

      <div
        className="ml-auto flex items-center gap-2"
        style={NODRAG_STYLE}
      >
        {rightSlot}

        <div className="ml-2 flex items-center gap-1">
          <button
            className="grid h-8 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={() => window.electron?.window?.minimize?.()}
            title="Свернуть"
          >
            <Minus className="h-4 w-4" />
          </button>

          <button
            className="grid h-8 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={async () => {
              await window.electron?.window?.maximize?.();
              await refresh();
            }}
            title={maximizeTitle}
          >
            <MaxIcon className="h-3.5 w-3.5" />
          </button>

          <button
            className="grid h-8 w-9 place-items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
            onClick={() => window.electron?.window?.close?.()}
            title="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}