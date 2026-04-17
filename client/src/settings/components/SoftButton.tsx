import type { ReactNode } from "react";
import { cn } from "../../ui/cn/cn";

export function SoftButton({
  onClick,
  icon,
  children,
  variant = "ghost",
  danger,
}: {
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  variant?: "ghost" | "primary";
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
        "transition outline-none active:scale-[0.99]",
        "focus-visible:ring-2 focus-visible:ring-cyan-300/25",
        danger
          ? "bg-rose-500/10 border border-rose-300/20 text-rose-100 hover:bg-rose-500/15"
          : variant === "primary"
            ? "bg-gradient-to-b from-cyan-300/15 to-cyan-300/5 border border-cyan-200/20 text-white/90 hover:bg-cyan-300/20"
            : "bg-white/[0.03] border border-white/[0.08] text-white/85 hover:bg-white/[0.06]"
      )}
    >
      {icon}
      {children}
    </button>
  );
}
