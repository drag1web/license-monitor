import type React from "react";
import { cn } from "./cn/cn";

export function Card({
  className,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...p}
      className={cn(
        "rounded-xl border border-slate-300 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)]",
        className
      )}
    />
  );
}