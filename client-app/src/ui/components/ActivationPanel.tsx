import { Loader2, Lock, ShieldCheck } from "lucide-react";
import type { Screen } from "../services/licenseService.js";

export function ActivationPanel({
  screen,
  licenseKey,
  busy,
  onKeyChange,
  onActivate,
  onTryAnotherKey,
}: {
  screen: Screen;
  licenseKey: string;
  busy: boolean;
  onKeyChange: (v: string) => void;
  onActivate: () => void;
  onTryAnotherKey: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Lock className="h-4 w-4 text-slate-600" />
        Активация лицензии
      </div>

      <div className="mt-2 text-sm leading-6 text-slate-600">
        Введите лицензионный ключ, выданный администратором системы.
      </div>

      <input
        value={licenseKey}
        onChange={(e) => onKeyChange(e.target.value)}
        placeholder="LM-XXXX-XXXX-XXXX"
        className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onActivate}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Активировать
        </button>

        {screen === "invalid" && (
          <button
            type="button"
            onClick={onTryAnotherKey}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ввести другой ключ
          </button>
        )}
      </div>
    </div>
  );
}