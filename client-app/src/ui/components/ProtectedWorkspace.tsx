import { ShieldCheck } from "lucide-react";
import { fmtDate } from "../services/licenseService.js";
import { ProductWorkspace } from "./ProductWorkspace.js";

export function ProtectedWorkspace({
  activationId,
  expiresAt,
  busy,
  lastCheckAt,
  offlineMode,
  serverUrl,
  deviceName,
  onDeactivate,
}: {
  activationId: number | null;
  expiresAt: string | null;
  busy: boolean;
  lastCheckAt: string;
  offlineMode: boolean;
  serverUrl: string;
  deviceName: string;
  onDeactivate: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Рабочая область
        </div>

        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
          доступ разрешён
        </span>
      </div>

      <ProductWorkspace
        activationId={activationId}
        expiresAt={expiresAt}
        lastCheckAt={lastCheckAt}
        offlineMode={offlineMode}
        serverUrl={serverUrl}
        deviceName={deviceName}
      />

      <button
        type="button"
        disabled={busy}
        onClick={onDeactivate}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
      >
        Деактивировать устройство
      </button>
    </div>
  );
}