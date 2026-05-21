import { Loader2 } from "lucide-react";
import { GlassCard } from "./GlassCard.js";
import { Shell } from "./Shell.js";

export function LoadingScreen() {
  return (
    <Shell>
      <GlassCard className="w-full max-w-lg p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Entitlex
            </div>
            <div className="text-xl font-semibold text-slate-950">
              Проверка лицензии...
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Подключение к серверу лицензирования.
            </div>
          </div>
        </div>
      </GlassCard>
    </Shell>
  );
}