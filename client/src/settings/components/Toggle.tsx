import { cn } from "../../ui/cn/cn";

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex items-center gap-3 rounded-2xl border px-3.5 py-2",
        checked
          ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100"
          : "border-white/[0.08] bg-white/[0.03] text-white/75 hover:bg-white/[0.06]",
        "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
      )}
    >
      <span
        className={cn(
          "h-5 w-9 rounded-full relative border",
          checked ? "border-cyan-300/20 bg-cyan-500/20" : "border-white/10 bg-white/5"
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-white transition",
            checked ? "left-[18px]" : "left-[2px]"
          )}
        />
      </span>
      <span className="text-sm font-semibold">{label ?? (checked ? "On" : "Off")}</span>
    </button>
  );
}
