import { AlertTriangle, CheckCircle2, WifiOff, XCircle } from "lucide-react";
import {
  daysUntil,
  isExpiringSoon,
  licenseLifetimePercent,
  reasonText,
  type Screen,
} from "../services/licenseService.js";

export function LicenseStatusCard({
  screen,
  reason,
  offlineMode,
  expiresAt,
}: {
  screen: Screen;
  reason: string;
  offlineMode: boolean;
  expiresAt: string | null;
}) {
  const daysLeft = daysUntil(expiresAt);
  const percent = licenseLifetimePercent(expiresAt);

  if (screen === "valid" && offlineMode) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-amber-800">
          <WifiOff className="h-5 w-5" />
          <div className="font-semibold">Автономный режим</div>
        </div>
        <div className="mt-2 text-sm leading-6 text-amber-700">
          Сервер лицензирования временно недоступен. Приложение работает по последней успешной проверке до окончания offline grace.
        </div>
      </div>
    );
  }

  if (screen === "valid" && isExpiringSoon(expiresAt)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          <div className="font-semibold">Лицензия скоро истекает</div>
        </div>

        <div className="mt-2 text-sm leading-6 text-amber-700">
          {daysLeft !== null
            ? `Лицензия истекает ${daysLeft === 1 ? "через 1 день" : `через ${daysLeft} дней`}. Обновите срок действия в системе лицензирования.`
            : "Срок лицензии неизвестен."}
        </div>

        {percent !== null && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-amber-700">
              <span>Период действия</span>
              <span>{percent}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-amber-100 ring-1 ring-amber-200">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === "valid") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          <div className="font-semibold">Лицензия активна</div>
        </div>
        <div className="mt-2 text-sm leading-6 text-emerald-700">
          Сервер подтверждает лицензию. Рабочая область доступна пользователю.
        </div>
      </div>
    );
  }

  if (screen === "invalid") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-red-800">
          <XCircle className="h-5 w-5" />
          <div className="font-semibold">Доступ запрещён</div>
        </div>
        <div className="mt-2 text-sm leading-6 text-red-700">
          {reasonText(reason)}
        </div>
      </div>
    );
  }

  return null;
}