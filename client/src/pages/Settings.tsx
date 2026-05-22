import React from "react";
import { Card } from "../ui/Card";
import { cn } from "../ui/cn/cn";
import { useSettings } from "../settings/SettingsContext";
import {
  exportSettingsJson,
  importSettingsJson,
  defaultSettings,
} from "../settings/store";
import { useToast } from "../ui/toast";
import { useAuth } from "../auth/AuthContext";

import { download, downloadProtectedFile } from "../api";

import {
  Settings as SettingsIcon,
  Palette,
  Table2,
  Shield,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  SlidersHorizontal,
  Cpu,
  Eye,
  Info,
  Database,
  FileSpreadsheet,
  GitBranch,
  KeyRound,
  Server,
  Boxes,
  ChevronDown,
} from "lucide-react";

import type {
  Settings,
  Density,
  StartRoute,
  RunsLimit,
  LicensesMode,
} from "../settings/types";

const DENSITIES: Density[] = ["comfortable", "compact"];
const ROUTES: StartRoute[] = ["/", "/runs", "/licenses"];
const RUNS_LIMITS: RunsLimit[] = [50, 100, 200, 500];
const AUTO_REFRESH: number[] = [0, 10, 30, 60, 120, 300];
const LICENSES_MODES: LicensesMode[] = [
  "all",
  "pinned",
  "risk",
  "expiring",
  "deficit",
];

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function Section({
  icon,
  title,
  description,
  right,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  const header = (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-start md:justify-between">
      <div className="flex gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
          {icon}
        </div>

        <div>
          <div className="text-base font-semibold text-slate-950">{title}</div>

          {description && (
            <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {right}

        {collapsible && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {open ? "Свернуть" : "Развернуть"}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                open && "rotate-180"
              )}
            />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="overflow-hidden">
      {header}

      {open && <div className="divide-y divide-slate-200">{children}</div>}
    </Card>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] md:items-center">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>

        {hint && (
          <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div>
        )}
      </div>

      <div className="md:flex md:justify-end">{children}</div>
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none",
        "focus:border-slate-600 focus:ring-2 focus:ring-slate-100",
        "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400",
        "md:w-[320px]"
      )}
    >
      {options.map((x) => (
        <option key={x.value} value={x.value}>
          {x.label}
        </option>
      ))}
    </select>
  );
}

function ToggleBox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-10 min-w-[160px] items-center justify-between gap-3 rounded-lg border px-3 text-sm font-medium transition",
        checked
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "h-5 w-9 rounded-full p-0.5 transition",
          checked ? "bg-white/25" : "bg-slate-200"
        )}
      >
        <span
          className={cn(
            "block h-4 w-4 rounded-full bg-white transition",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </span>
    </button>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none",
        "placeholder:text-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-100",
        props.className
      )}
    />
  );
}

function ActionButton({
  children,
  onClick,
  variant = "ghost",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition",
        variant === "primary" &&
        "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
        variant === "ghost" &&
        "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        variant === "danger" &&
        "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  );
}

function InfoTile({
  icon,
  title,
  value,
  text,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  text: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm",
        tone === "neutral" && "border-slate-200",
        tone === "ok" && "border-emerald-200 bg-emerald-50/40",
        tone === "warn" && "border-amber-200 bg-amber-50/40"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg border",
            tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600",
            tone === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-700",
            tone === "warn" && "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {icon}
        </span>
        {title}
      </div>

      <div className="mt-3 text-sm font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-600">{text}</div>
    </div>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { settings, setSettings, reset } = useSettings();
  const { user, changePassword } = useAuth();

  const isAdmin = user?.role === "admin";
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const [importText, setImportText] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordBusy, setPasswordBusy] = React.useState(false);

  const pretty = React.useMemo(() => exportSettingsJson(settings), [settings]);

  const update = React.useCallback(
    (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    [setSettings]
  );

  const updatePerf = React.useCallback(
    (patch: Partial<Settings["perf"]>) =>
      setSettings((s) => ({ ...s, perf: { ...s.perf, ...patch } })),
    [setSettings]
  );

  const updateData = React.useCallback(
    (patch: Partial<Settings["data"]>) =>
      setSettings((s) => ({ ...s, data: { ...s.data, ...patch } })),
    [setSettings]
  );

  const updateAdv = React.useCallback(
    (patch: Partial<Settings["advanced"]>) =>
      setSettings((s) => ({
        ...s,
        advanced: { ...s.advanced, ...patch },
      })),
    [setSettings]
  );

  function doExport() {
    downloadText("license-monitor.settings.json", pretty);

    toast.push({
      tone: "success",
      title: "Экспорт",
      message: "Файл настроек скачан.",
    });
  }

  async function doDatabaseBackup() {
    try {
      await downloadProtectedFile(
        download.databaseBackup,
        "license-monitor-backup.sqlite"
      );

      toast.push({
        tone: "success",
        title: "Резервное копирование",
        message: "Копия базы данных скачана.",
      });
    } catch (e) {
      toast.push({
        tone: "error",
        title: "Backup не скачан",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function doImportFromFile(file: File) {
    const txt = await file.text();
    const next = importSettingsJson(txt);

    setSettings(next);

    toast.push({
      tone: "success",
      title: "Импорт",
      message: "Настройки применены.",
    });
  }

  function doImportFromText() {
    try {
      const next = importSettingsJson(importText);
      setSettings(next);

      toast.push({
        tone: "success",
        title: "Импорт",
        message: "Настройки применены из текста.",
      });
    } catch (e: unknown) {
      toast.push({
        tone: "error",
        title: "Импорт не удался",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function doChangePassword() {
    if (!isAdmin) {
      toast.push({
        tone: "error",
        title: "Недостаточно прав",
        message: "Сменить пароль может только admin.",
      });
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.push({
        tone: "error",
        title: "Смена пароля",
        message: "Заполните все поля.",
      });
      return;
    }

    if (newPassword.length < 4) {
      toast.push({
        tone: "error",
        title: "Смена пароля",
        message: "Новый пароль должен быть не короче 4 символов.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.push({
        tone: "error",
        title: "Смена пароля",
        message: "Новый пароль и подтверждение не совпадают.",
      });
      return;
    }

    setPasswordBusy(true);

    try {
      await changePassword(currentPassword, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      toast.push({
        tone: "success",
        title: "Пароль изменён",
        message: "Новый пароль успешно сохранён.",
      });
    } catch (e: unknown) {
      toast.push({
        tone: "error",
        title: "Смена пароля не удалась",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <SettingsIcon className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="text-xl font-semibold text-slate-950">
                Настройки
              </div>

              <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Управление поведением приложения, таблицами, импортом настроек и
                параметрами безопасности. Настройки интерфейса хранятся локально.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <ActionButton onClick={doExport}>
              <Download className="h-4 w-4" />
              Экспорт
            </ActionButton>

            <ActionButton onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Импорт
            </ActionButton>

            <ActionButton
              variant="danger"
              onClick={() => {
                reset();
                toast.push({
                  tone: "info",
                  title: "Сброс",
                  message: "Настройки сброшены на значения по умолчанию.",
                });
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Сбросить
            </ActionButton>

            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;

                doImportFromFile(f).catch((err: unknown) => {
                  toast.push({
                    tone: "error",
                    title: "Импорт не удался",
                    message: err instanceof Error ? err.message : String(err),
                  });
                });

                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      </Card>

      <Section
        icon={<Database className="h-5 w-5" />}
        title="Источники данных"
        description="Раздел показывает, какие данные участвуют в расчёте лицензий и где хранится основной источник правды."
      >
        <div className="grid gap-3 px-5 py-4 lg:grid-cols-2">
          <InfoTile
            icon={<FileSpreadsheet className="h-4 w-4" />}
            title="Установки программ"
            value="CSV-инвентаризация"
            text="Файл installations.csv используется как входной источник установок ПО. В промышленной версии этот источник может быть заменён агентом или интеграцией с системой инвентаризации."
            tone="warn"
          />

          <InfoTile
            icon={<Database className="h-4 w-4" />}
            title="Лицензии организации"
            value="Реестр licenses_registry"
            text="Файл licenses.csv используется только как механизм импорта. После загрузки данные сохраняются в реестр лицензий и уже оттуда участвуют в расчётах."
            tone="ok"
          />

          <InfoTile
            icon={<GitBranch className="h-4 w-4" />}
            title="Правила сопоставления"
            value="Справочник mapping_rules"
            text="Файл mapping.csv импортирует правила в базу данных. При запуске проверки используются правила из справочника, а не скрытый CSV-файл."
            tone="ok"
          />

          <InfoTile
            icon={<KeyRound className="h-4 w-4" />}
            title="Клиентские ключи Entitlex"
            value="client_licenses"
            text="Клиентские ключи относятся к отдельному контуру серверной проверки лицензирования и не смешиваются с реестром лицензий организации."
            tone="neutral"
          />
        </div>
      </Section>

      <Section
        icon={<Boxes className="h-5 w-5" />}
        title="Контуры системы"
        description="License Monitor разделяет учёт лицензий организации и серверную проверку клиентских ключей Entitlex."
      >
        <div className="grid gap-3 px-5 py-4 lg:grid-cols-2">
          <InfoTile
            icon={<Database className="h-4 w-4" />}
            title="Контур мониторинга лицензий"
            value="installations → mapping_rules → runPipeline"
            text="Используется для расчёта потребности, дефицита, истекающих лицензий, несопоставленных установок и формирования отчётов."
            tone="ok"
          />

          <InfoTile
            icon={<Server className="h-4 w-4" />}
            title="Контур Entitlex"
            value="activate / check / deactivate"
            text="Используется отдельным клиентским приложением для проверки ключа на сервере и блокировки доступа при blocked, expired или deactivated."
            tone="neutral"
          />
        </div>
      </Section>

      <Section
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Ограничения текущей версии"
        description="Эти ограничения не блокируют работу системы, но показывают направления промышленного развития."
      >
        <div className="grid gap-3 px-5 py-4 lg:grid-cols-3">
          <InfoTile
            icon={<FileSpreadsheet className="h-4 w-4" />}
            title="Сбор установок"
            value="Через CSV"
            text="Автоматический агент пока не входит в текущую версию. Для дипломного проекта используется импорт данных инвентаризации."
            tone="warn"
          />

          <InfoTile
            icon={<Database className="h-4 w-4" />}
            title="Хранилище"
            value="SQLite"
            text="SQLite подходит для локального внедрения и демонстрации. Для промышленной многопользовательской версии возможно развитие в сторону PostgreSQL."
            tone="neutral"
          />

          <InfoTile
            icon={<Shield className="h-4 w-4" />}
            title="Безопасность"
            value="Базовый уровень"
            text="Реализованы роли, rate limit, audit log и серверная проверка Entitlex. HTTPS, CSRF, secure cookies и расширенный RBAC относятся к развитию."
            tone="neutral"
          />
        </div>
      </Section>

      <Section
        icon={<Database className="h-5 w-5" />}
        title="Резервное копирование"
        description="SQLite используется как локальное хранилище системы. Перед обновлением, переносом или демонстрацией рекомендуется скачать резервную копию базы данных."
      >
        <div className="px-5 py-4">
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">
                Копия базы данных
              </div>

              <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Система создаёт консистентную SQLite-копию через серверный endpoint.
                В backup попадают реестр лицензий, запуски проверок, результаты,
                уведомления, клиентские ключи и журнал действий.
              </div>

              {!isAdmin && (
                <div className="mt-2 text-xs text-amber-700">
                  Скачать резервную копию может только пользователь с ролью admin.
                </div>
              )}
            </div>

            <ActionButton
              variant="primary"
              onClick={() => void doDatabaseBackup()}
              disabled={!isAdmin}
            >
              <Download className="h-4 w-4" />
              Скачать backup
            </ActionButton>
          </div>
        </div>
      </Section>



      <Section
        icon={<Palette className="h-5 w-5" />}
        title="Интерфейс"
        description="Внешний вид и плотность отображения. Переключение темы временно заблокировано, чтобы не ломать единый корпоративный стиль."
        collapsible
        defaultOpen={false}
      >
        <FieldRow
          label="Тема"
          hint="Сейчас используется единый светлый корпоративный стиль. Переключение будет доступно после полной адаптации тем."
        >
          <div className="w-full md:w-[320px]">
            <SelectBox
              value="corporate-light"
              disabled
              onChange={() => { }}
              options={[
                {
                  value: "corporate-light",
                  label: "Corporate Light — активно",
                },
              ]}
            />

            <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Смена темы отключена до завершения редизайна всех экранов.
            </div>
          </div>
        </FieldRow>

        <FieldRow
          label="Плотность таблицы"
          hint="Комфортная — больше контекста, компактная — быстрее сканировать строки."
        >
          <SelectBox
            value={settings.density}
            onChange={(v) =>
              update({
                density: DENSITIES.includes(v as Density)
                  ? (v as Density)
                  : "comfortable",
              })
            }
            options={[
              { value: "comfortable", label: "Комфортная" },
              { value: "compact", label: "Компактная" },
            ]}
          />
        </FieldRow>

        <FieldRow
          label="Уменьшить анимации"
          hint="Снижает количество анимаций и переходов."
        >
          <ToggleBox
            checked={settings.reduceMotion}
            onChange={(v) => update({ reduceMotion: v })}
            label={settings.reduceMotion ? "Включено" : "Выключено"}
          />
        </FieldRow>
      </Section>

      <Section
        icon={<Cpu className="h-5 w-5" />}
        title="Производительность"
        description="Параметры, которые помогают уменьшить нагрузку на интерфейс."
        collapsible
        defaultOpen={false}
      >
        <FieldRow
          label="Отключать эффекты во время скролла"
          hint="Во время скролла отключаются тяжёлые переходы в таблицах."
        >
          <ToggleBox
            checked={settings.perf.disableEffectsWhileScroll}
            onChange={(v) => updatePerf({ disableEffectsWhileScroll: v })}
            label={
              settings.perf.disableEffectsWhileScroll ? "Включено" : "Выключено"
            }
          />
        </FieldRow>

        <FieldRow
          label="Отключить размытие фона"
          hint="Полезно для слабых устройств. В новом дизайне blur почти не используется."
        >
          <ToggleBox
            checked={settings.perf.disableBackdropBlur}
            onChange={(v) => updatePerf({ disableBackdropBlur: v })}
            label={settings.perf.disableBackdropBlur ? "Отключено" : "Включено"}
          />
        </FieldRow>

        <FieldRow
          label="Упростить тени"
          hint="Уменьшает визуальную глубину и повышает плавность."
        >
          <ToggleBox
            checked={settings.perf.simplifyShadows}
            onChange={(v) => updatePerf({ simplifyShadows: v })}
            label={settings.perf.simplifyShadows ? "Упрощено" : "Обычные"}
          />
        </FieldRow>

        <FieldRow
          label="Отключить подсветку строк"
          hint="Отключает декоративную подсветку строк таблицы."
        >
          <ToggleBox
            checked={settings.perf.disableRowShine}
            onChange={(v) => updatePerf({ disableRowShine: v })}
            label={settings.perf.disableRowShine ? "Отключено" : "Включено"}
          />
        </FieldRow>
      </Section>

      <Section
        icon={<SlidersHorizontal className="h-5 w-5" />}
        title="Поведение"
        description="Стартовая страница, автообновление и подтверждения действий."
        collapsible
        defaultOpen={false}
      >
        <FieldRow label="Стартовая страница" hint="Куда переходить после входа.">
          <SelectBox
            value={settings.startRoute}
            onChange={(v) =>
              update({
                startRoute: ROUTES.includes(v as StartRoute)
                  ? (v as StartRoute)
                  : "/",
              })
            }
            options={[
              { value: "/", label: "Обзор" },
              { value: "/runs", label: "Запуски проверок" },
              { value: "/licenses", label: "Реестр лицензий" },
            ]}
          />
        </FieldRow>

        <FieldRow
          label="Автообновление"
          hint="Интервал обновления данных. Значение 0 отключает автообновление."
        >
          <SelectBox
            value={String(settings.autoRefreshSec)}
            onChange={(v) => {
              const n = Number(v);
              update({ autoRefreshSec: Number.isFinite(n) ? n : 0 });
            }}
            options={AUTO_REFRESH.map((n) => ({
              value: String(n),
              label:
                n === 0
                  ? "Выключено"
                  : n < 60
                    ? `Каждые ${n} сек`
                    : n === 60
                      ? "Каждую минуту"
                      : n === 120
                        ? "Каждые 2 минуты"
                        : "Каждые 5 минут",
            }))}
          />
        </FieldRow>

        <FieldRow
          label="Подтверждать перед запуском"
          hint="Показывать подтверждение перед запуском проверки."
        >
          <ToggleBox
            checked={settings.confirmBeforeRun}
            onChange={(v) => update({ confirmBeforeRun: v })}
            label={settings.confirmBeforeRun ? "Включено" : "Выключено"}
          />
        </FieldRow>

        <FieldRow
          label="Подтверждать перед удалением"
          hint="Показывать подтверждение перед удалением записей."
        >
          <ToggleBox
            checked={settings.confirmBeforeDelete}
            onChange={(v) => update({ confirmBeforeDelete: v })}
            label={settings.confirmBeforeDelete ? "Включено" : "Выключено"}
          />
        </FieldRow>

        <FieldRow
          label="Запоминать фильтры"
          hint="Сохранять режимы и фильтры между перезапусками приложения."
        >
          <ToggleBox
            checked={settings.rememberFilters}
            onChange={(v) => update({ rememberFilters: v })}
            label={settings.rememberFilters ? "Включено" : "Выключено"}
          />
        </FieldRow>
      </Section>

      <Section
        icon={<Table2 className="h-5 w-5" />}
        title="Таблицы и данные"
        description="Режимы отображения таблиц и настройки страниц данных."
        collapsible
        defaultOpen={false}
      >
        <FieldRow
          label="Лимит запусков"
          hint="Сколько запусков показывать в истории и сводках."
        >
          <SelectBox
            value={String(settings.data.runsLimit)}
            onChange={(v) => {
              const n = Number(v) as RunsLimit;
              updateData({ runsLimit: RUNS_LIMITS.includes(n) ? n : 200 });
            }}
            options={RUNS_LIMITS.map((n) => ({
              value: String(n),
              label: String(n),
            }))}
          />
        </FieldRow>

        <FieldRow
          label="Режим лицензий по умолчанию"
          hint="Какой фильтр открывать на странице реестра лицензий."
        >
          <SelectBox
            value={settings.data.defaultModeLicenses}
            onChange={(v) => {
              const m = v as LicensesMode;
              updateData({
                defaultModeLicenses: LICENSES_MODES.includes(m) ? m : "all",
              });
            }}
            options={[
              { value: "all", label: "Все" },
              { value: "pinned", label: "Закреплённые" },
              { value: "risk", label: "Риск" },
              { value: "expiring", label: "Скоро истекают" },
              { value: "deficit", label: "Дефицит" },
            ]}
          />
        </FieldRow>

        <FieldRow label="Липкая шапка" hint="Закреплять шапку таблицы при скролле.">
          <ToggleBox
            checked={settings.data.stickyHeader}
            onChange={(v) => updateData({ stickyHeader: v })}
            label={settings.data.stickyHeader ? "Включено" : "Выключено"}
          />
        </FieldRow>

        <FieldRow label="Колонка: производитель" hint="Показывать производителя в таблице лицензий.">
          <ToggleBox
            checked={settings.data.showVendor}
            onChange={(v) => updateData({ showVendor: v })}
            label={settings.data.showVendor ? "Показывать" : "Скрыть"}
          />
        </FieldRow>

        <FieldRow label="Колонка: тип" hint="Показывать тип лицензии.">
          <ToggleBox
            checked={settings.data.showType}
            onChange={(v) => updateData({ showType: v })}
            label={settings.data.showType ? "Показывать" : "Скрыть"}
          />
        </FieldRow>

        <FieldRow label="Примечания" hint="Показывать заметки и пояснения в таблице.">
          <ToggleBox
            checked={settings.data.showNote}
            onChange={(v) => updateData({ showNote: v })}
            label={settings.data.showNote ? "Показывать" : "Скрыть"}
          />
        </FieldRow>

        <FieldRow
          label="Разницы: только топ"
          hint="Показывать только основные изменения между запусками."
        >
          <ToggleBox
            checked={settings.data.showOnlyTopDiff}
            onChange={(v) => updateData({ showOnlyTopDiff: v })}
            label={settings.data.showOnlyTopDiff ? "Только топ" : "Все"}
          />
        </FieldRow>
      </Section>

      <Section
        icon={<Shield className="h-5 w-5" />}
        title="Безопасность"
        description={
          isAdmin
            ? "Смена пароля текущего пользователя."
            : "Смена пароля доступна только пользователю с ролью admin."
        }
      >
        {isAdmin ? (
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <TextInput
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Текущий пароль"
              />

              <TextInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Новый пароль"
              />

              <TextInput
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ActionButton
                variant="primary"
                onClick={doChangePassword}
                disabled={passwordBusy}
              >
                <Shield className="h-4 w-4" />
                {passwordBusy ? "Сохранение..." : "Сменить пароль"}
              </ActionButton>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">
                Недостаточно прав
              </div>

              <div className="mt-1 text-sm text-slate-600">
                Пользователь с ролью viewer не может менять пароль через эту
                страницу.
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section
        icon={<Shield className="h-5 w-5" />}
        title="Дополнительно"
        description="Импорт и экспорт настроек через JSON."
        right={
          <ToggleBox
            checked={showAdvanced}
            onChange={setShowAdvanced}
            label={showAdvanced ? "Показано" : "Скрыто"}
          />
        }
      >
        {showAdvanced ? (
          <>
            <FieldRow label="Dev-панель" hint="Показывать служебные элементы для отладки.">
              <ToggleBox
                checked={settings.advanced.showDevPanel}
                onChange={(v) => updateAdv({ showDevPanel: v })}
                label={settings.advanced.showDevPanel ? "Включено" : "Выключено"}
              />
            </FieldRow>

            <FieldRow
              label="Опасная зона"
              hint="Разрешить дополнительные опасные действия, если они будут добавлены."
            >
              <ToggleBox
                checked={settings.advanced.allowDangerZone}
                onChange={(v) => updateAdv({ allowDangerZone: v })}
                label={settings.advanced.allowDangerZone ? "Включено" : "Выключено"}
              />
            </FieldRow>

            <div className="px-5 py-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      Импорт из текста
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      Вставьте JSON настроек и примените его вручную.
                    </div>
                  </div>

                  <ActionButton
                    onClick={() => {
                      setImportText(exportSettingsJson(defaultSettings));
                      toast.push({
                        tone: "info",
                        title: "По умолчанию",
                        message: "Дефолтные настройки вставлены в поле.",
                      });
                    }}
                  >
                    <Eye className="h-4 w-4" />
                    Вставить дефолты
                  </ActionButton>
                </div>

                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={exportSettingsJson(defaultSettings)}
                  className="mt-3 min-h-[180px] w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton variant="primary" onClick={doImportFromText}>
                    <Upload className="h-4 w-4" />
                    Применить JSON
                  </ActionButton>

                  <ActionButton
                    onClick={() => {
                      setImportText(pretty);
                      toast.push({
                        tone: "info",
                        title: "Текущие",
                        message: "Текущие настройки вставлены в поле.",
                      });
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Вставить текущие
                  </ActionButton>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <AlertTriangle className="h-4 w-4" />
                  При ошибке JSON настройки не будут применены.
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="px-5 py-4 text-sm text-slate-500">
            Дополнительные параметры скрыты.
          </div>
        )}
      </Section>
    </div>
  );
}