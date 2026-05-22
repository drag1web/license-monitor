import { AlertTriangle, RefreshCw, Zap } from "lucide-react";

export function RuntimePanel({
  checking,
  onCheckNow,
}: {
  checking: boolean;
  onCheckNow: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Контроль доступа
          </div>

          <div className="mt-2 text-sm leading-6 text-slate-600">
            Если администратор заблокирует ключ, клиент автоматически закроет доступ к рабочей области.
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600">
          <Zap className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs">
        <div className="flex justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-slate-500">Политика</span>
          <span className="font-medium text-slate-900">серверная проверка</span>
        </div>

        <div className="flex justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-slate-500">Действие при отказе</span>
          <span className="font-medium text-red-700">блокировка</span>
        </div>
      </div>

      <button
        type="button"
        disabled={checking}
        onClick={onCheckNow}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        <RefreshCw className={checking ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {checking ? "Проверка..." : "Проверить сейчас"}
      </button>
    </div>
  );
}