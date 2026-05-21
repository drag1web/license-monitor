import { Clock, Monitor, Server } from "lucide-react";
import type { DeviceInfo } from "../services/licenseService.js";

export function DeviceInfoGrid({
  device,
  lastCheckAt,
}: {
  device: DeviceInfo | null;
  lastCheckAt: string;
}) {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Monitor className="h-4 w-4" />
          Устройство
        </div>
        <div className="mt-2 truncate font-mono text-sm text-slate-900">
          {device?.device_id ?? "—"}
        </div>
        <div className="mt-1 truncate text-xs text-slate-500">
          {device?.device_name ?? "Неизвестное устройство"}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Server className="h-4 w-4" />
          Сервер лицензирования
        </div>
        <div className="mt-2 truncate text-sm text-slate-900">
          {device?.server_url ?? "—"}
        </div>
        <div className="mt-1 text-xs text-slate-500">источник состояния лицензии</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Clock className="h-4 w-4" />
          Последняя проверка
        </div>
        <div className="mt-2 text-sm text-slate-900">
          {lastCheckAt === "cached" ? "из кэша" : lastCheckAt === "offline" ? "offline" : lastCheckAt || "—"}
        </div>
        <div className="mt-1 text-xs text-slate-500">автоматическая перепроверка</div>
      </div>
    </div>
  );
}