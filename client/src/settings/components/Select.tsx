import { cn } from "../../ui/cn/cn";
import type { ReactNode } from "react";

export function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-2xl border px-3.5 py-2 text-sm",
        "bg-white/[0.03] border-white/[0.08] text-white/85",
        "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
      )}
    >
      {children}
    </select>
  );
}
