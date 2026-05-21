import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Edit3,
  Monitor,
  Save,
  Server,
  Settings,
  WifiOff,
  X,
} from "lucide-react";
import type { DeviceInfo } from "../services/licenseService.js";

export type ClientSettingsPatch = {
  server_url: string;
  check_interval: number;
};

export function ClientSettingsCard({
  device,
  checkIntervalSec,
  offlineGraceHours,
  offlineMode,
  saving,
  onSave,
}: {
  device: DeviceInfo | null;
  checkIntervalSec: number;
  offlineGraceHours: number;
  offlineMode: boolean;
  saving: boolean;
  onSave: (patch: ClientSettingsPatch) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [serverUrl, setServerUrl] = useState(device?.server_url ?? "");
  const [interval, setIntervalValue] = useState(checkIntervalSec);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) {
      setServerUrl(device?.server_url ?? "");
      setIntervalValue(checkIntervalSec);
      setError("");
    }
  }, [device?.server_url, checkIntervalSec, editing]);

  async function save() {
    const url = serverUrl.trim();
    const nextInterval = Number(interval);

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("Адрес сервера должен начинаться с http:// или https://");
      return;
    }

    if (!Number.isFinite(nextInterval) || nextInterval < 3) {
      setError("Интервал проверки должен быть минимум 3 секунды");
      return;
    }

    setError("");

    await onSave({
      server_url: url,
      check_interval: Math.max(3, nextInterval),
    });

    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Settings className="h-4 w-4 text-slate-600" />
            Настройки клиента
          </div>

          <div className="mt-2 text-sm leading-6 text-slate-600">
            Параметры подключения Entitlex к серверу лицензирования.
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          title={editing ? "Отмена" : "Редактировать"}
        >
          {editing ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="mb-2 flex items-center gap-2 text-slate-500">
            <Server className="h-4 w-4" />
            Сервер
          </div>

          {editing ? (
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              placeholder="http://localhost:3000"
            />
          ) : (
            <div className="truncate text-slate-900">
              {device?.server_url ?? "—"}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="flex items-center gap-2 text-slate-500">
            <Monitor className="h-4 w-4" />
            Устройство
          </span>
          <span className="truncate text-right font-mono text-xs text-slate-900">
            {device?.device_id ?? "—"}
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="mb-2 flex items-center gap-2 text-slate-500">
            <Clock className="h-4 w-4" />
            Интервал проверки
          </div>

          {editing ? (
            <input
              type="number"
              min={3}
              max={3600}
              value={interval}
              onChange={(e) => setIntervalValue(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
            />
          ) : (
            <div className="text-slate-900">{checkIntervalSec} сек.</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="flex items-center gap-2 text-slate-500">
            <WifiOff className="h-4 w-4" />
            Offline grace
          </span>
          <span className={offlineMode ? "font-semibold text-amber-700" : "text-slate-900"}>
            {offlineGraceHours} ч. {offlineMode ? "· активно" : ""}
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {editing && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "Сохранение..." : "Сохранить настройки"}
          </button>
        </div>
      )}
    </div>
  );
}