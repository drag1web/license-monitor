import type React from "react";
import { cn } from "./cn/cn";

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...p}
      className={cn(
        "rounded-3xl border backdrop-blur-xl",
        "bg-[rgba(var(--card),var(--cardA))]",
        "border-[rgba(var(--fg),var(--borderA))]",
        "shadow-[0_0_0_1px_rgba(var(--fg),0.05),0_20px_80px_-40px_rgba(0,0,0,0.35)]",
        className
      )}
    />
  );
}
