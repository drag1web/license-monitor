import { cn } from "./cn/cn";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string | boolean;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

export function Input({
  className,
  error,
  leftSlot,
  rightSlot,
  ...props
}: Props) {
  return (
    <div
      className={cn(
        // layout
        "group relative isolate flex items-center gap-2 rounded-2xl px-4 py-3",
        "backdrop-blur-xl transition-all duration-300 ease-out",

        // surface
        "bg-white/[0.045]",
        !error &&
          "border border-white/10 hover:border-white/20 " +
            "focus-within:border-cyan-200/40 " +
            "focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]",

        // error state
        error &&
          "border border-rose-400/40 " +
            "shadow-[0_0_0_4px_rgba(244,63,94,0.18)]",

        // lift
        "hover:-translate-y-[1px] focus-within:-translate-y-[1px]",
        "hover:shadow-[0_20px_70px_-40px_rgba(0,0,0,0.6)]",

        // glow ring
        "before:absolute before:inset-[-2px] before:rounded-[calc(theme(borderRadius.2xl)+2px)] before:content-['']",
        "before:opacity-0 before:transition-opacity before:duration-300",
        !error &&
          "before:bg-[conic-gradient(from_180deg,rgba(34,211,238,0.55),rgba(99,102,241,0.55),rgba(236,72,153,0.45),rgba(34,211,238,0.55))] group-focus-within:before:opacity-100",
        error &&
          "before:bg-[conic-gradient(from_180deg,rgba(244,63,94,0.85),rgba(220,38,38,0.85),rgba(249,115,22,0.75),rgba(244,63,94,0.85))] before:opacity-100",
        "before:blur-xl",

        // inner glass sheen
        "after:absolute after:inset-[1px] after:rounded-[calc(theme(borderRadius.2xl)-1px)] after:content-['']",
        "after:bg-gradient-to-b after:from-white/[0.10] after:to-white/[0.02]",

        // content above layers
        "[&>*]:relative [&>*]:z-10",

        className
      )}
    >
      {leftSlot}

      <input
        {...props}
        className={cn(
          "w-full bg-transparent outline-none text-sm",
          "text-white/90 placeholder:text-white/30",
          "caret-cyan-300",
          "disabled:opacity-50"
        )}
      />

      {rightSlot}
    </div>
  );
}
