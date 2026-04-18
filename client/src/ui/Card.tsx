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
        "rounded-3xl backdrop-blur-xl bg-glass shadow-soft-panel",
        className
      )}
    />
  );
}