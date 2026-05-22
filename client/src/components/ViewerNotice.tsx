import { Eye } from "lucide-react";
import { cn } from "../ui/cn/cn";

export function ViewerNotice({
  title = "Режим просмотра",
  message = "Вы вошли как пользователь с правами просмотра. Изменение данных, запуск проверок, импорт CSV и удаление записей недоступны.",
  className,
}: {
  title?: string;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-200 bg-white text-amber-700">
          <Eye className="h-4 w-4" />
        </div>

        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 text-sm leading-6 text-amber-800">
            {message}
          </div>
        </div>
      </div>
    </div>
  );
}