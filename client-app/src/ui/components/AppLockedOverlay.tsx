import { Lock, RefreshCw } from "lucide-react";
import { reasonText } from "../services/licenseService.js";

export function AppLockedOverlay({
  reason,
  onCheckAgain,
  onEnterAnotherKey,
}: {
  reason: string;
  onCheckAgain: () => void;
  onEnterAnotherKey: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-6 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
        <div className="grid h-14 w-14 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-700">
          <Lock className="h-6 w-6" />
        </div>

        <div className="mt-5 text-2xl font-semibold text-slate-950">
          Приложение заблокировано
        </div>

        <div className="mt-2 text-sm leading-6 text-red-700">
          {reasonText(reason)}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCheckAgain}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Проверить повторно
          </button>

          <button
            type="button"
            onClick={onEnterAnotherKey}
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Ввести другой ключ
          </button>
        </div>
      </div>
    </div>
  );
}