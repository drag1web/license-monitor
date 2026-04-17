import * as React from "react";
import { cn } from "./cn/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  disabled,
  ...props
}: Props) {
  const base =
    // layout
    "relative inline-flex items-center justify-center gap-2 rounded-2xl font-semibold select-none " +
    // text always visible
    "text-center leading-none " +
    // motion
    "transition-colors transition-transform duration-150 ease-out " +
    "active:scale-[0.97] " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none " +
    // focus
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-5 text-[0.95rem]",
  }[size];

  const variants = {
    primary:
      // readable light accent
      "text-slate-950 " +
      "bg-gradient-to-b from-white via-slate-100 to-slate-200 " +
      "hover:from-white hover:to-slate-100 " +
      "shadow-[0_10px_30px_rgba(0,0,0,0.35)] " +
      "hover:shadow-[0_14px_40px_rgba(0,0,0,0.45)]",

    ghost:
      // glassy but calm
      "text-white/90 " +
      "bg-white/[0.06] border border-white/12 " +
      "hover:bg-white/[0.10] hover:border-white/20 " +
      "shadow-[0_6px_24px_rgba(0,0,0,0.25)]",

    danger:
      // critical, readable
      "text-white " +
      "bg-gradient-to-b from-rose-500 to-rose-600 " +
      "hover:from-rose-400 hover:to-rose-600 " +
      "shadow-[0_12px_36px_rgba(244,63,94,0.45)] " +
      "hover:shadow-[0_16px_46px_rgba(244,63,94,0.65)]",
  }[variant];

  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(base, sizes, variants, className)}
    />
  );
}
