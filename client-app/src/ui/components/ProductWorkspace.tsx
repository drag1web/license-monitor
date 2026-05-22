import {
  CheckCircle2,
  Clock,
  Database,
  Monitor,
  Server,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { fmtDate } from "../services/licenseService.js";

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>

      <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </span>

      {badge ? (
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {value}
        </span>
      ) : (
        <span className="max-w-[180px] truncate font-medium text-slate-900">
          {value}
        </span>
      )}
    </div>
  );
}

export function ProductWorkspace({
  activationId,
  expiresAt,
  lastCheckAt,
  offlineMode,
  serverUrl,
  deviceName,
}: {
  activationId: number | null;
  expiresAt: string | null;
  lastCheckAt: string;
  offlineMode: boolean;
  serverUrl: string;
  deviceName: string;
}) {
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Entitlex защищённая область активна
        </div>

        <div className="mt-1 text-xs leading-5 text-emerald-700">
          Доступ открыт, потому что сервер лицензирования подтвердил ключ для
          текущего устройства.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Metric
          label="ID активации"
          value={activationId ? String(activationId) : "—"}
          hint="текущая активация"
          icon={ShieldCheck}
        />

        <Metric
          label="Срок"
          value={fmtDate(expiresAt)}
          hint="дата окончания лицензии"
          icon={Clock}
        />

        <Metric
          label="Режим"
          value={offlineMode ? "Автономно" : "Онлайн"}
          hint="состояние проверки"
          icon={offlineMode ? WifiOff : Database}
        />
      </div>

      <div className="grid gap-2">
        <Row icon={Monitor} label="Устройство" value={deviceName || "—"} />
        <Row icon={Server} label="Сервер" value={serverUrl || "—"} />
        <Row icon={ShieldCheck} label="Режим доступа" value="Защищено" badge />
      </div>
    </div>
  );
}