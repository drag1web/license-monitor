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
  Lock,
} from "lucide-react";

import { SectionTitle } from "../settings/components/SectionTitle";
import { FieldRow } from "../settings/components/FieldRow";
import { Select } from "../settings/components/Select";
import { Toggle } from "../settings/components/Toggle";
import { SoftButton } from "../settings/components/SoftButton";

import type {
  Settings,
  Theme,
  Density,
  StartRoute,
  RunsLimit,
  LicensesMode,
} from "../settings/types";

const THEMES: Theme[] = ["graphite", "midnight", "snow"];
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
  const blob = new Blob([text], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
      setSettings((s) => ({
        ...s,
        perf: { ...s.perf, ...patch },
      })),
    [setSettings]
  );

  const updateData = React.useCallback(
    (patch: Partial<Settings["data"]>) =>
      setSettings((s) => ({
        ...s,
        data: { ...s.data, ...patch },
      })),
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
      message: "settings.json скачан.",
    });
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
      const msg = e instanceof Error ? e.message : String(e);
      toast.push({
        tone: "error",
        title: "Импорт не удался",
        message: msg,
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
        message: "Заполни все поля.",
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
        title: "Пароль изменен",
        message: "Новый пароль успешно сохранен.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.push({
        tone: "error",
        title: "Смена пароля не удалась",
        message: msg,
      });
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          "relative overflow-hidden rounded-3xl p-5",
          "border border-white/[0.08] bg-white/[0.02]"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex items-start gap-4">
          <div className="h-12 w-12 rounded-3xl grid place-items-center bg-white/[0.04] border border-white/[0.10]">
            <SettingsIcon className="h-6 w-6 text-cyan-200/85" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs text-white/50 tracking-wide">Параметры</div>
            <div className="mt-1 text-2xl font-semibold text-white/90 tracking-tight">
              Настройки
            </div>
            <div className="mt-1 text-sm text-white/55 max-w-[80ch]">
              Интерфейс, поведение, производительность, таблицы. Всё хранится
              локально.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SoftButton onClick={doExport} icon={<Download className="h-4 w-4" />}>
              Экспорт
            </SoftButton>

            <SoftButton
              onClick={() => fileRef.current?.click()}
              icon={<Upload className="h-4 w-4" />}
            >
              Импорт
            </SoftButton>

            <SoftButton
              danger
              onClick={() => {
                reset();
                toast.push({
                  tone: "info",
                  title: "Сброс",
                  message: "Настройки сброшены на значения по умолчанию.",
                });
              }}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              Сбросить
            </SoftButton>

            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                doImportFromFile(f).catch((err: unknown) => {
                  const msg = err instanceof Error ? err.message : String(err);
                  toast.push({
                    tone: "error",
                    title: "Импорт не удался",
                    message: msg,
                  });
                });
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      </Card>

      {!isAdmin && (
        <Card className="p-4 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl grid place-items-center bg-white/[0.03] border border-white/[0.08]">
              <Lock className="h-5 w-5 text-white/70" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white/85">
                Режим ограниченного доступа
              </div>
              <div className="mt-1 text-xs text-white/55">
                Настройки интерфейса доступны, но смена пароля разрешена только
                пользователю с ролью admin.
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <SectionTitle
          icon={<Palette className="h-5 w-5 text-cyan-200/80" />}
          title="Интерфейс"
          desc="Внешний вид и плотность. Тут всё, что ощущается каждый день."
        />

        <FieldRow
          label="Тема"
          hint="Меняет общий вид приложения (класс/переменные темы)"
        >
          <Select
            value={settings.theme}
            onChange={(v) =>
              update({
                theme: THEMES.includes(v as Theme) ? (v as Theme) : "graphite",
              })
            }
            options={[
              { value: "graphite", label: "Graphite (по умолчанию)" },
              { value: "midnight", label: "Midnight" },
              { value: "snow", label: "Snow" },
            ]}
          />
        </FieldRow>

        <FieldRow
          label="Плотность таблицы"
          hint="Комфортная = больше контекста, компактная = быстрее сканировать"
        >
          <Select
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
          hint="Снижает/убирает анимации (полезно на слабых машинах)"
        >
          <Toggle
            checked={settings.reduceMotion}
            onChange={(v) => update({ reduceMotion: v })}
            label={settings.reduceMotion ? "Включено" : "Выключено"}
          />
        </FieldRow>
      </Card>

      <Card className="p-5 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <SectionTitle
          icon={<Cpu className="h-5 w-5 text-cyan-200/80" />}
          title="Производительность"
          desc="Настройки, которые реально лечат лаги скролла и тяжелые эффекты."
        />

        <FieldRow
          label="Отключать эффекты во время скролла"
          hint="Во время скролла выключаем shine/transition для FPS"
        >
          <Toggle
            checked={settings.perf.disableEffectsWhileScroll}
            onChange={(v) => updatePerf({ disableEffectsWhileScroll: v })}
            label={
              settings.perf.disableEffectsWhileScroll ? "Включено" : "Выключено"
            }
          />
        </FieldRow>

        <FieldRow
          label="Отключить размытие фона"
          hint="Выключает blur (backdrop-filter) — часто главный убийца FPS"
        >
          <Toggle
            checked={settings.perf.disableBackdropBlur}
            onChange={(v) => updatePerf({ disableBackdropBlur: v })}
            label={settings.perf.disableBackdropBlur ? "Выключено" : "Включено"}
          />
        </FieldRow>

        <FieldRow
          label="Упростить тени"
          hint="Уменьшает большие тени (blur 70-90px) для плавности"
        >
          <Toggle
            checked={settings.perf.simplifyShadows}
            onChange={(v) => updatePerf({ simplifyShadows: v })}
            label={settings.perf.simplifyShadows ? "Упрощено" : "Полные"}
          />
        </FieldRow>

        <FieldRow
          label="Отключить подсветку строк"
          hint="Убирает radial-gradient подсветку строк таблицы"
        >
          <Toggle
            checked={settings.perf.disableRowShine}
            onChange={(v) => updatePerf({ disableRowShine: v })}
            label={settings.perf.disableRowShine ? "Выключено" : "Включено"}
          />
        </FieldRow>
      </Card>

      <Card className="p-5 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <SectionTitle
          icon={<SlidersHorizontal className="h-5 w-5 text-cyan-200/80" />}
          title="Поведение"
          desc="Как приложение стартует, обновляется и что подтверждает."
        />

        <FieldRow label="Стартовая страница" hint="Куда попадать после входа">
          <Select
            value={settings.startRoute}
            onChange={(v) =>
              update({
                startRoute: ROUTES.includes(v as StartRoute)
                  ? (v as StartRoute)
                  : "/",
              })
            }
            options={[
              { value: "/", label: "Главная страница" },
              { value: "/runs", label: "Запуски" },
              { value: "/licenses", label: "Лицензии" },
            ]}
          />
        </FieldRow>

        <FieldRow
          label="Автообновление"
          hint="Автообновление данных (0 = выключено)"
        >
          <Select
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
                      ? "Каждые 60 сек"
                      : n === 120
                        ? "Каждые 120 сек"
                        : "Каждые 5 минут",
            }))}
          />
        </FieldRow>

        <FieldRow
          label="Подтверждать перед запуском"
          hint="Подтверждение перед запуском проверки"
        >
          <Toggle
            checked={settings.confirmBeforeRun}
            onChange={(v) => update({ confirmBeforeRun: v })}
            label={settings.confirmBeforeRun ? "ВКЛ" : "ВЫКЛ"}
          />
        </FieldRow>

        <FieldRow
          label="Подтверждать перед удалением"
          hint="Подтверждение перед удалением (лицензии/запуски и т.п.)"
        >
          <Toggle
            checked={settings.confirmBeforeDelete}
            onChange={(v) => update({ confirmBeforeDelete: v })}
            label={settings.confirmBeforeDelete ? "ВКЛ" : "ВЫКЛ"}
          />
        </FieldRow>

        <FieldRow
          label="Запоминать фильтры"
          hint="Запоминать режимы/фильтры (Licenses) между перезапусками"
        >
          <Toggle
            checked={settings.rememberFilters}
            onChange={(v) => update({ rememberFilters: v })}
            label={settings.rememberFilters ? "Включено" : "Выключено"}
          />
        </FieldRow>
      </Card>

      <Card className="p-5 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <SectionTitle
          icon={<Table2 className="h-5 w-5 text-cyan-200/80" />}
          title="Таблицы и данные"
          desc="Режимы по умолчанию и видимость колонок."
        />

        <FieldRow
          label="Лимит запусков"
          hint="Сколько запусков показывать в истории/дашборде"
        >
          <Select
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
          hint="Какой фильтр открывать по умолчанию на странице Licenses"
        >
          <Select
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

        <FieldRow
          label="Липкая шапка"
          hint="Липкая шапка таблицы (может влиять на производительность)"
        >
          <Toggle
            checked={settings.data.stickyHeader}
            onChange={(v) => updateData({ stickyHeader: v })}
            label={settings.data.stickyHeader ? "Включено" : "Выключено"}
          />
        </FieldRow>

        <FieldRow
          label="Колонки: Vendor"
          hint="Показывать колонку Vendor по умолчанию"
        >
          <Toggle
            checked={settings.data.showVendor}
            onChange={(v) => updateData({ showVendor: v })}
            label={settings.data.showVendor ? "Показывать" : "Скрыть"}
          />
        </FieldRow>

        <FieldRow
          label="Колонки: Type"
          hint="Показывать колонку Type по умолчанию"
        >
          <Toggle
            checked={settings.data.showType}
            onChange={(v) => updateData({ showType: v })}
            label={settings.data.showType ? "Показывать" : "Скрыть"}
          />
        </FieldRow>

        <FieldRow
          label="Заметки"
          hint="Показывать заметки (в compact можно скрывать автоматически)"
        >
          <Toggle
            checked={settings.data.showNote}
            onChange={(v) => updateData({ showNote: v })}
            label={settings.data.showNote ? "Показывать" : "Скрыть"}
          />
        </FieldRow>

        <FieldRow
          label="Разницы: только топ"
          hint="Показывать только топ изменений (ускоряет UI)"
        >
          <Toggle
            checked={settings.data.showOnlyTopDiff}
            onChange={(v) => updateData({ showOnlyTopDiff: v })}
            label={settings.data.showOnlyTopDiff ? "Только топ" : "Показывать все"}
          />
        </FieldRow>
      </Card>

      <Card className="p-5 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <SectionTitle
          icon={<Shield className="h-5 w-5 text-cyan-200/80" />}
          title="Безопасность"
          desc={
            isAdmin
              ? "Смена пароля текущего пользователя."
              : "Смена пароля доступна только для admin."
          }
        />

        {isAdmin ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Текущий пароль"
                className={cn(
                  "w-full rounded-2xl border p-3 text-sm",
                  "bg-black/20 border-white/[0.10] text-white/85",
                  "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                )}
              />

              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Новый пароль"
                className={cn(
                  "w-full rounded-2xl border p-3 text-sm",
                  "bg-black/20 border-white/[0.10] text-white/85",
                  "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                )}
              />

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повтори новый пароль"
                className={cn(
                  "w-full rounded-2xl border p-3 text-sm",
                  "bg-black/20 border-white/[0.10] text-white/85",
                  "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                )}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SoftButton
                onClick={doChangePassword}
                icon={<Shield className="h-4 w-4" />}
                disabled={passwordBusy}
              >
                {passwordBusy ? "Сохраняю..." : "Сменить пароль"}
              </SoftButton>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <div className="text-sm font-semibold text-white/85">
              Недостаточно прав
            </div>
            <div className="mt-1 text-xs text-white/55">
              Пользователь с ролью viewer не может менять пароль через эту страницу.
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <SectionTitle
          icon={<Shield className="h-5 w-5 text-cyan-200/80" />}
          title="Дополнительно"
          desc="Импорт/экспорт через текст и dev-панель."
          right={
            <Toggle
              checked={showAdvanced}
              onChange={setShowAdvanced}
              label={showAdvanced ? "Показано" : "Скрыто"}
            />
          }
        />

        {showAdvanced && (
          <>
            <FieldRow
              label="Dev-панель"
              hint="Показывать служебные элементы (для отладки)"
            >
              <Toggle
                checked={settings.advanced.showDevPanel}
                onChange={(v) => updateAdv({ showDevPanel: v })}
                label={settings.advanced.showDevPanel ? "Включено" : "Выключено"}
              />
            </FieldRow>

            <FieldRow
              label="Опасная зона"
              hint="Разрешить опасные действия/кнопки (если появятся)"
            >
              <Toggle
                checked={settings.advanced.allowDangerZone}
                onChange={(v) => updateAdv({ allowDangerZone: v })}
                label={settings.advanced.allowDangerZone ? "Включено" : "Выключено"}
              />
            </FieldRow>

            <div className="mt-4 rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/85">
                    Импорт из текста
                  </div>
                  <div className="mt-1 text-[12px] text-white/45">
                    Вставь JSON настроек и нажми «Применить».
                  </div>
                </div>

                <SoftButton
                  onClick={() => {
                    setImportText(exportSettingsJson(defaultSettings));
                    toast.push({
                      tone: "info",
                      title: "По умолчанию",
                      message: "Дефолтные настройки вставлены в поле.",
                    });
                  }}
                  icon={<Eye className="h-4 w-4" />}
                >
                  Вставить дефолты
                </SoftButton>
              </div>

              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={exportSettingsJson(defaultSettings)}
                className={cn(
                  "mt-3 w-full min-h-[180px] rounded-2xl border p-3 text-[12px] font-mono",
                  "bg-black/20 border-white/[0.10] text-white/85",
                  "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                )}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <SoftButton
                  onClick={doImportFromText}
                  icon={<Upload className="h-4 w-4" />}
                  variant="primary"
                >
                  Применить JSON
                </SoftButton>

                <SoftButton
                  onClick={() => {
                    setImportText(pretty);
                    toast.push({
                      tone: "info",
                      title: "Текущие",
                      message: "Текущие настройки вставлены в поле.",
                    });
                  }}
                  icon={<Download className="h-4 w-4" />}
                >
                  Вставить текущие
                </SoftButton>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[12px] text-white/45">
                <AlertTriangle className="h-4 w-4" />
                Любая ошибка JSON → настройки не применятся.
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}