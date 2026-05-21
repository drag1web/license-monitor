import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  download,
  getRuns,
  runCheck,
  type RunRow,
} from "../api";

import { Card } from "../ui/Card";
import { cn } from "../ui/cn/cn";
import { useToast } from "../ui/toast";
import { ViewerNotice } from "../components/ViewerNotice";
import { useAuth } from "../auth/AuthContext";
import {
  Table,
  TableInner,
  TableScroll,
  TableCaption,
  TableEmpty,
  TableSkeleton,
  THead,
  TBody,
  Tr,
  Td,
  Th,
} from "../ui/Table";

import {
  RefreshCw,
  Play,
  FileSpreadsheet,
  FileText,
  Download as DownloadIcon,
  TriangleAlert,
  CircleCheck,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Layers,
  TimerReset,
  Upload,
  GitBranch,
  Database,
  KeyRound,
  ListChecks,
  FileWarning,
  ClipboardList,
} from "lucide-react";

type Tone = "ok" | "warn" | "bad" | "none";

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatInt(n: unknown) {
  const v = safeNum(n);
  try {
    return new Intl.NumberFormat("ru-RU").format(v);
  } catch {
    return String(v);
  }
}

function severityFrom(last?: RunRow): Tone {
  if (!last) return "none";

  const deficit = safeNum(last.deficit_products);
  const expiring = safeNum(last.expiring_products);
  const unmatched = safeNum(last.unmatched_installs);

  if (deficit > 0) return "bad";
  if (expiring > 0 || unmatched > 0) return "warn";
  return "ok";
}

function iconForTone(kind: Tone) {
  if (kind === "ok") return <CircleCheck className="h-4 w-4" />;
  if (kind === "warn") return <TriangleAlert className="h-4 w-4" />;
  if (kind === "bad") return <TriangleAlert className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

const PANEL =
  "rounded-xl border border-slate-300 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)]";

function toneLeftBorder(kind: Tone) {
  if (kind === "ok") return "border-l-4 border-l-emerald-500";
  if (kind === "warn") return "border-l-4 border-l-amber-500";
  if (kind === "bad") return "border-l-4 border-l-red-500";
  return "border-l-4 border-l-slate-300";
}

function SoftButton({
  onClick,
  disabled,
  variant = "ghost",
  leftIcon,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  leftIcon?: ReactNode;
  children: ReactNode;
}) {
  const v =
    variant === "primary"
      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        v
      )}
    >
      {leftIcon}
      {children}
    </button>
  );
}

function StatusChip({
  children,
  kind = "none",
}: {
  children: ReactNode;
  kind?: Tone;
}) {
  const cls =
    kind === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : kind === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : kind === "bad"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium",
        cls
      )}
    >
      {iconForTone(kind)}
      {children}
    </span>
  );
}

function HeroMetric({
  label,
  value,
  tone = "none",
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className={cn(PANEL, toneLeftBorder(tone), "p-4")}>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon && <span className="text-slate-400">{icon}</span>}
        <span>{label}</span>
      </div>

      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  desc,
  right,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-slate-900">
          {icon && <span className="text-slate-500">{icon}</span>}
          <span className="text-base font-semibold">{title}</span>
        </div>

        {desc && <div className="mt-1 text-sm text-slate-500">{desc}</div>}
      </div>

      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function ProcessStep({
  n,
  title,
  desc,
  to,
  icon,
}: {
  n: number;
  title: string;
  desc: string;
  to: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-400">Шаг {n}</div>
          <div className="mt-1 text-sm font-semibold text-slate-900 group-hover:underline">
            {title}
          </div>
          <div className="mt-1 text-xs leading-relaxed text-slate-500">
            {desc}
          </div>
        </div>
      </div>
    </Link>
  );
}

function QuickAction({
  to,
  title,
  desc,
  icon,
}: {
  to: string;
  title: string;
  desc: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900 group-hover:underline">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
          {desc}
        </span>
      </span>

      <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600" />
    </Link>
  );
}

function DownloadTile({
  href,
  label,
  icon,
  sub,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  sub?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900">
          {label}
        </span>
        {sub && (
          <span className="block truncate text-xs text-slate-500">{sub}</span>
        )}
      </span>

      <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600" />
    </a>
  );
}

function SummaryItem({
  label,
  value,
  tone = "none",
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}) {
  const cls =
    tone === "bad"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={cn("rounded-lg border px-3 py-2", cls)}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lastCreatedRunId, setLastCreatedRunId] = useState<number | null>(null);

  const mounted = useRef(true);
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";

  const orderedRuns = useMemo(() => {
    return [...runs].sort((a, b) => Number(b.id) - Number(a.id));
  }, [runs]);

  const last = orderedRuns[0];
  const recentRuns = orderedRuns.slice(0, 5);
  const tone = severityFrom(last);

  const kpi = useMemo(() => {
    return {
      total: last ? safeNum(last.total_products) : 0,
      deficit: last ? safeNum(last.deficit_products) : 0,
      expiring: last ? safeNum(last.expiring_products) : 0,
      unmatched: last ? safeNum(last.unmatched_installs) : 0,
    };
  }, [last]);

  async function refresh() {
    setErr("");
    setLoading(true);

    try {
      const r = await getRuns();
      if (!mounted.current) return;
      setRuns(r);
    } catch (e: any) {
      if (!mounted.current) return;
      setErr(String(e?.message ?? e));
    } finally {
      if (!mounted.current) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    mounted.current = true;
    refresh();

    return () => {
      mounted.current = false;
    };
  }, []);

  async function onRun() {
    if (!isAdmin) {
      toast.push({
        tone: "error",
        title: "Недостаточно прав",
        message: "Только admin может запускать проверку.",
      });
      return;
    }

    setBusy(true);
    setErr("");

    toast.push({
      tone: "info",
      title: "Запуск проверки",
      message: "Запрос отправлен. Ожидаю ответ сервера…",
      duration: 2400,
    });

    try {
      const out = await runCheck();
      if (!out.ok) throw new Error(out.error ?? "Ошибка запуска");

      if (out.runId) {
        setLastCreatedRunId(out.runId);
        window.dispatchEvent(new CustomEvent("alerts:refresh"));

        navigate(`/runs/${out.runId}`);
        return;
      }

      toast.push({
        tone: "success",
        title: "Готово",
        message: out.runId
          ? `Проверка #${out.runId} завершена. Можно открыть детали запуска.`
          : "Проверка успешно завершена. Обновляю дашборд…",
      });

      await refresh();
      window.dispatchEvent(new CustomEvent("alerts:refresh"));
    } catch (e: any) {
      const msg = String(e?.message ?? e);

      toast.push({
        tone: "error",
        title: "Ошибка запуска",
        message: msg,
        duration: 6500,
        action: {
          label: "Скопировать",
          onClick: () => navigator.clipboard.writeText(msg),
        },
      });

      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  const heroTitle =
    tone === "ok"
      ? "Система в порядке"
      : tone === "warn"
        ? "Есть риски"
        : tone === "bad"
          ? "Требуются действия"
          : "Нет данных";

  const heroSubtitle =
    tone === "ok"
      ? "Дефицитов не обнаружено. Состояние лицензирования находится в норме."
      : tone === "warn"
        ? "Обнаружены истекающие лицензии или несопоставленные установки."
        : tone === "bad"
          ? "Обнаружен дефицит лицензий. Необходимо проверить проблемные позиции."
          : isAdmin
            ? "Запустите первую проверку, чтобы получить состояние лицензирования."
            : "Ожидается первый запуск проверки.";

  return (
    <div className="space-y-6">
      <Card className={cn(PANEL, toneLeftBorder(tone), "p-5")}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-50">
              {tone === "ok" ? (
                <CircleCheck className="h-6 w-6 text-emerald-600" />
              ) : tone === "warn" ? (
                <TriangleAlert className="h-6 w-6 text-amber-600" />
              ) : tone === "bad" ? (
                <TriangleAlert className="h-6 w-6 text-red-600" />
              ) : (
                <Clock className="h-6 w-6 text-slate-500" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                License Monitor
              </div>

              <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                {heroTitle}
              </div>

              <div className="mt-2 max-w-[72ch] text-sm leading-relaxed text-slate-600">
                {heroSubtitle}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <StatusChip kind={tone}>
                  {tone === "ok"
                    ? "Норма"
                    : tone === "warn"
                      ? "Предупреждение"
                      : tone === "bad"
                        ? "Критично"
                        : "Нет запусков"}
                </StatusChip>

                {last && (
                  <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-4 w-4" />
                    Последний запуск: {String(last.run_at)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {isAdmin && (
              <SoftButton
                variant="primary"
                onClick={onRun}
                disabled={busy}
                leftIcon={<Play className="h-4 w-4" />}
              >
                {busy ? "Запускаю..." : "Запустить проверку"}
              </SoftButton>
            )}

            <SoftButton
              onClick={() => refresh()}
              disabled={busy}
              leftIcon={
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              }
            >
              Обновить
            </SoftButton>

            {last && (
              <SoftButton
                onClick={() => navigate(`/runs/${last.id}`)}
                leftIcon={<ArrowUpRight className="h-4 w-4" />}
              >
                Открыть #{last.id}
              </SoftButton>
            )}
          </div>
        </div>

        {err && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-sm font-semibold text-red-700">Ошибка</div>
            <div className="mt-1 break-words text-xs text-red-600">{err}</div>
          </div>
        )}

        {!isAdmin && (
          <div className="mt-5">
            <ViewerNotice message="У вас нет прав на запуск новых проверок и изменение данных. Доступен только просмотр истории и отчётов." />
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HeroMetric
            label="Продуктов"
            value={formatInt(kpi.total)}
            icon={<Layers className="h-4 w-4" />}
          />

          <HeroMetric
            label="Дефицитов"
            value={formatInt(kpi.deficit)}
            tone={kpi.deficit > 0 ? "bad" : "ok"}
            icon={<ShieldCheck className="h-4 w-4" />}
          />

          <HeroMetric
            label="Истекающих"
            value={formatInt(kpi.expiring)}
            tone={kpi.expiring > 0 ? "warn" : "ok"}
            icon={<TimerReset className="h-4 w-4" />}
          />

          <HeroMetric
            label="Несопоставленных"
            value={formatInt(kpi.unmatched)}
            tone={kpi.unmatched > 0 ? "warn" : "ok"}
            icon={<Zap className="h-4 w-4" />}
          />
        </div>
      </Card>

      <Card className={cn(PANEL, "p-5")}>
        <SectionHeader
          icon={<ListChecks className="h-5 w-5" />}
          title="Рабочий процесс мониторинга"
          desc="Основная цепочка системы: от CSV-данных до расчёта рисков и отчёта."
          right={
            lastCreatedRunId ? (
              <SoftButton
                variant="primary"
                onClick={() => navigate(`/runs/${lastCreatedRunId}`)}
                leftIcon={<ArrowUpRight className="h-4 w-4" />}
              >
                Открыть запуск #{lastCreatedRunId}
              </SoftButton>
            ) : last ? (
              <Link
                to={`/runs/${last.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Последний запуск #{last.id}
                <ArrowUpRight className="h-4 w-4 text-slate-500" />
              </Link>
            ) : null
          }
        />

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <ProcessStep
            n={1}
            title="Импорты CSV"
            desc="Загрузка installations, licenses и mapping."
            to="/imports"
            icon={<Upload className="h-4 w-4" />}
          />

          <ProcessStep
            n={2}
            title="Сопоставление"
            desc="Правила приводят названия ПО к продуктам."
            to="/dictionaries/mapping"
            icon={<GitBranch className="h-4 w-4" />}
          />

          <ProcessStep
            n={3}
            title="Проверка"
            desc="Расчёт потребности, лицензий, дельты и рисков."
            to="/runs"
            icon={<Play className="h-4 w-4" />}
          />

          <ProcessStep
            n={4}
            title="Детали"
            desc="Дефицит, сроки и несопоставленные строки."
            to={last ? `/runs/${last.id}` : "/runs"}
            icon={<FileWarning className="h-4 w-4" />}
          />

          <ProcessStep
            n={5}
            title="Реестр"
            desc="Организационные лицензии и доступные места."
            to="/licenses"
            icon={<Database className="h-4 w-4" />}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className={cn(PANEL, "p-5")}>
          <SectionHeader
            icon={<Zap className="h-5 w-5" />}
            title="Быстрые действия"
            desc="Переходы к основным разделам системы."
          />

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <QuickAction
              to="/imports"
              title="Импортировать CSV"
              desc="Обновить установки, лицензии или mapping."
              icon={<Upload className="h-4 w-4" />}
            />

            <QuickAction
              to={last ? `/runs/${last.id}` : "/runs"}
              title="Детали запуска"
              desc="Открыть последний результат проверки."
              icon={<ClipboardList className="h-4 w-4" />}
            />

            <QuickAction
              to="/licenses"
              title="Реестр лицензий"
              desc="Места, сроки действия и типы лицензий."
              icon={<Database className="h-4 w-4" />}
            />

            <QuickAction
              to="/dictionaries/mapping"
              title="Правила сопоставления"
              desc="Связать названия ПО из CSV с продуктами."
              icon={<GitBranch className="h-4 w-4" />}
            />

            <QuickAction
              to="/runs"
              title="История запусков"
              desc="Все проверки и сравнение результатов."
              icon={<Clock className="h-4 w-4" />}
            />

            <QuickAction
              to="/client-licenses"
              title="Клиентские ключи"
              desc="Отдельный контур server-side licensing Entitlex."
              icon={<KeyRound className="h-4 w-4" />}
            />
          </div>
        </Card>

        <Card className={cn(PANEL, "p-5")}>
          <SectionHeader
            icon={<Clock className="h-5 w-5" />}
            title="Последний запуск"
            desc="Краткая сводка последней проверки."
            right={
              last ? (
                <Link
                  to={`/runs/${last.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Открыть #{last.id}
                  <ArrowUpRight className="h-4 w-4 text-slate-500" />
                </Link>
              ) : null
            }
          />

          {!last ? (
            <div className="mt-4">
              <TableEmpty
                title="Запусков пока нет"
                description={
                  isAdmin
                    ? "Запустите проверку или загрузите CSV в разделе импортов."
                    : "История запусков пока пуста."
                }
              />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <SummaryItem label="Дата" value={String(last.run_at)} />
              <SummaryItem label="Продуктов" value={formatInt(last.total_products)} />
              <SummaryItem
                label="Дефицитов"
                value={formatInt(last.deficit_products)}
                tone={safeNum(last.deficit_products) > 0 ? "bad" : "ok"}
              />
              <SummaryItem
                label="Истекающих"
                value={formatInt(last.expiring_products)}
                tone={safeNum(last.expiring_products) > 0 ? "warn" : "ok"}
              />
              <SummaryItem
                label="Несопоставленных"
                value={formatInt(last.unmatched_installs)}
                tone={safeNum(last.unmatched_installs) > 0 ? "warn" : "ok"}
              />
              <SummaryItem label="ID запуска" value={`#${last.id}`} />
            </div>
          )}
        </Card>
      </div>

      <Card className={cn(PANEL, "p-5")}>
        <SectionHeader
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Отчёты и экспорт"
          desc="Файлы формируются по результатам последней проверки."
        />

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <DownloadTile
            href={download.xlsx}
            label="Excel"
            sub="Сводная таблица"
            icon={<FileSpreadsheet className="h-4 w-4" />}
          />

          <DownloadTile
            href={download.reportCsv}
            label="report.csv"
            sub="Отчёт по продуктам"
            icon={<FileText className="h-4 w-4" />}
          />

          <DownloadTile
            href={download.runsCsv}
            label="runs.csv"
            sub="История запусков"
            icon={<DownloadIcon className="h-4 w-4" />}
          />

          <DownloadTile
            href={download.unmatchedCsv}
            label="unmatched.csv"
            sub="Несопоставленные строки"
            icon={<DownloadIcon className="h-4 w-4" />}
          />

          <DownloadTile
            href={download.badRowsCsv}
            label="bad_rows.csv"
            sub="Проблемные строки"
            icon={<DownloadIcon className="h-4 w-4" />}
          />
        </div>
      </Card>

      <Card className={cn(PANEL, "overflow-hidden p-0")}>
        <Table>
          <TableCaption
            title="Последние запуски"
            description="Краткая история последних проверок. Полная история доступна в разделе запусков."
            right={
              <Link
                to="/runs"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Все запуски
                <ArrowUpRight className="h-4 w-4 text-slate-500" />
              </Link>
            }
          />

          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : recentRuns.length === 0 ? (
            <TableEmpty
              title="Запусков пока нет"
              description={
                isAdmin
                  ? "Нажмите «Запустить проверку», чтобы создать первый прогон."
                  : "История запусков пока пуста."
              }
            />
          ) : (
            <TableScroll>
              <TableInner density="comfortable">
                <THead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Дата</Th>
                    <Th>Продукты</Th>
                    <Th>Дефицит</Th>
                    <Th>Истекают</Th>
                    <Th>Несопоставленные</Th>
                  </tr>
                </THead>

                <TBody>
                  {recentRuns.map((r) => {
                    const deficit = safeNum(r.deficit_products);
                    const expiring = safeNum(r.expiring_products);
                    const unmatched = safeNum(r.unmatched_installs);

                    return (
                      <Tr key={r.id}>
                        <Td>
                          <div className="flex flex-col gap-1">
                            <Link
                              to={`/runs/${r.id}`}
                              className="font-semibold text-slate-900 hover:underline underline-offset-4"
                            >
                              #{r.id}
                            </Link>

                            <Link
                              to={`/runs/${r.id}/diff`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Сравнить
                            </Link>
                          </div>
                        </Td>

                        <Td className="text-slate-600">{String(r.run_at)}</Td>
                        <Td className="tabular-nums">{formatInt(r.total_products)}</Td>
                        <Td
                          className={cn(
                            "tabular-nums",
                            deficit > 0 ? "font-semibold text-red-600" : "text-slate-700"
                          )}
                        >
                          {formatInt(deficit)}
                        </Td>
                        <Td
                          className={cn(
                            "tabular-nums",
                            expiring > 0 ? "font-semibold text-amber-600" : "text-slate-700"
                          )}
                        >
                          {formatInt(expiring)}
                        </Td>
                        <Td
                          className={cn(
                            "tabular-nums",
                            unmatched > 0 ? "font-semibold text-amber-600" : "text-slate-700"
                          )}
                        >
                          {formatInt(unmatched)}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </TableInner>
            </TableScroll>
          )}
        </Table>
      </Card>
    </div>
  );
}