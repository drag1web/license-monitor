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
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
    "transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400";

  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
  }[size];

  const variants = {
    primary: "bg-slate-900 text-white hover:bg-slate-800",
    ghost:
      "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  }[variant];

  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(base, sizes, variants, className)}
    />
  );
}