import { Eye } from "lucide-react";
import { cn } from "../ui/cn/cn";

export function ViewerNotice({
  message = "У вас нет прав на изменение данных. Доступен только просмотр.",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-[rgba(var(--card),0.20)] px-4 py-3",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Eye className="h-4 w-4 text-[rgba(var(--fg),0.60)]" />
        </div>

        <div>
          <div className="text-sm font-semibold text-[rgba(var(--fg),0.86)]">
            Режим просмотра
          </div>
          <div className="mt-1 text-xs text-[rgba(var(--fg),0.56)]">
            {message}
          </div>
        </div>
      </div>
    </div>
  );
}