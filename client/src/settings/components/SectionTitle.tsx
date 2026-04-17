import type { ReactNode } from "react";

export function SectionTitle({
  icon,
  title,
  desc,
  right,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-11 w-11 rounded-2xl border border-white/[0.10] bg-white/[0.04] grid place-items-center">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        {desc && <div className="mt-0.5 text-[12px] text-white/50">{desc}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
