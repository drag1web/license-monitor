import type { ReactNode } from "react";
import { cn } from "../../ui/cn/cn";

export function SectionTitle({
  icon,
  title,
  desc,
  right,
  className,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              "h-12 w-12 shrink-0 rounded-2xl grid place-items-center",
              "border border-white/[0.10] bg-white/[0.04]",
              "shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
            )}
          >
            {icon}
          </div>

          <div className="min-w-0 pt-0.5">
            <div className="text-[17px] font-semibold leading-tight text-white/90">
              {title}
            </div>

            {desc && (
              <div className="mt-1 text-sm leading-relaxed text-white/50 max-w-[72ch]">
                {desc}
              </div>
            )}
          </div>
        </div>

        {right && <div className="shrink-0">{right}</div>}
      </div>

      <div className="mt-4 h-px bg-white/[0.08]" />
    </div>
  );
}