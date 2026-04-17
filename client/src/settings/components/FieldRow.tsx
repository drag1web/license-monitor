import type { ReactNode } from "react";

export function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 py-3 border-t border-white/[0.06]">
      <div className="md:w-[320px]">
        <div className="text-sm font-semibold text-white/80">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-white/45">{hint}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
