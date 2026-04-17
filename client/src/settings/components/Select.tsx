import React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../ui/cn/cn";

type OptionItem = {
  value: string;
  label: string;
};

export function Select({
  value,
  onChange,
  options,
  className,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: OptionItem[];
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const selected =
    options.find((x) => x.value === value) ?? options[0] ?? null;

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!rootRef.current || !target) return;
      if (!rootRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "w-full rounded-2xl border text-sm",
          "px-4 py-3 pr-12 text-left",
          "bg-white/[0.03] border-white/[0.08] text-white/90",
          "shadow-[0_10px_30px_rgba(0,0,0,0.16)]",
          "transition outline-none",
          "hover:bg-white/[0.045] hover:border-white/[0.12]",
          "focus-visible:ring-2 focus-visible:ring-cyan-300/25 focus-visible:border-cyan-300/20",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          open && "border-cyan-300/20 ring-2 ring-cyan-300/20"
        )}
      >
        <span className="block truncate">
          {selected?.label ?? "Выбрать"}
        </span>

        <span
          className={cn(
            "pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/45 transition-transform",
            open && "rotate-180"
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border",
            "border-white/[0.10] bg-[rgba(10,16,30,0.96)] backdrop-blur-xl",
            "shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
          )}
        >
          <div className="max-h-72 overflow-y-auto py-2">
            {options.map((opt) => {
              const active = opt.value === value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition",
                    active
                      ? "bg-cyan-500/14 text-cyan-100"
                      : "text-white/80 hover:bg-white/[0.05] hover:text-white"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}