import { useEffect, useState } from "react";
import { AlertTriangle, Save, Settings, X } from "lucide-react";

export type ClientSettings = {
  server_url: string;
  check_interval: number;
};

export function SettingsModal({
  open,
  settings,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  settings: ClientSettings;
  saving: boolean;
  onClose: () => void;
  onSave: (next: ClientSettings) => void | Promise<void>;
}) {
  const [serverUrl, setServerUrl] = useState(settings.server_url);
  const [checkInterval, setCheckInterval] = useState(settings.check_interval);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setServerUrl(settings.server_url);
    setCheckInterval(settings.check_interval);
    setError("");

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, settings.server_url, settings.check_interval, onClose]);

  if (!open) return null;

  async function save() {
    const url = serverUrl.trim();
    const interval = Number(checkInterval);

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("Адрес сервера должен начинаться с http:// или https://");
      return;
    }

    if (!Number.isFinite(interval) || interval < 3) {
      setError("Интервал проверки должен быть не меньше 3 секунд");
      return;
    }

    setError("");

    await onSave({
      server_url: url,
      check_interval: Math.max(3, interval),
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-5 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Закрыть настройки"
        onClick={onClose}
        className="absolute inset-0"
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                <Settings className="h-5 w-5" />
              </div>

              <div>
                <div className="text-xl font-semibold text-slate-950">
                  Настройки клиента
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-600">
                  Параметры подключения Entitlex к серверу лицензирования.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="space-y-4">
            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">
                Адрес сервера лицензирования
              </div>
              <input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:3000"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <div className="mt-1 text-xs text-slate-500">
                Например: http://localhost:3000 или адрес production-сервера.
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold text-slate-500">
                Интервал проверки, секунд
              </div>
              <input
                type="number"
                min={3}
                max={3600}
                value={checkInterval}
                onChange={(e) => setCheckInterval(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
              />
              <div className="mt-1 text-xs text-slate-500">
                Как часто клиент будет перепроверять лицензию во время работы.
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Отмена
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}