import { KeyRound, Settings } from "lucide-react";
import { Pill } from "./Pill.js";
import { getEntitlexVersion, type Screen } from "../services/licenseService.js";

export function AppHeader({
  screen,
  onOpenSettings,
}: {
  screen: Screen;
  onOpenSettings: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div className="flex gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
          <KeyRound className="h-6 w-6" />
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Entitlex
          </div>

          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Защищённое клиентское приложение
          </div>

          <div className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Доступ к рабочей области разрешается только после подтверждения лицензии сервером.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={screen === "valid" ? "ok" : screen === "invalid" ? "bad" : "neutral"}>
          {screen === "valid" ? "Активна" : screen === "invalid" ? "Заблокирована" : "Не активирована"}
        </Pill>

        <Pill tone="neutral">v{getEntitlexVersion()}</Pill>

        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Settings className="h-3.5 w-3.5" />
          Настройки
        </button>
      </div>
    </div>
  );
}