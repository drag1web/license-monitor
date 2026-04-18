import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  download,
  getRuns,
  runCheck,
  getRunResults,
  type RunRow,
} from "../api";

import { computeRunDiff, diffScore } from "../ui/diff/runDiff";
import { Card } from "../ui/Card";
import { cn } from "../ui/cn/cn";
import { useToast } from "../ui/toast";
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
  SortTh,
} from "../ui/Table";

import {
  RefreshCw,
  Play,
  FileSpreadsheet,
  FileText,
  Download as DownloadIcon,
  TriangleAlert,
  CircleCheck,
  Copy,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Layers,
  TimerReset,
  FolderOutput,
  Activity,
  Sparkles,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------
 * Table sorting
 * ------------------------------------------ */

type SortKey =
  | "id"
  | "run_at"
  | "total_products"
  | "deficit_products"
  | "expiring_products"
  | "unmatched_installs";

type SortDir = "asc" | "desc" | null;

function nextDir(d: SortDir): SortDir {
  if (d === null) return "asc";
  if (d === "asc") return "desc";
  return null;
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getVal(r: RunRow, k: SortKey): unknown {
  return (r as unknown as Record<string, unknown>)[k];
}

function cmpBy(key: SortKey, dir: Exclude<SortDir, null>) {
  const mul = dir === "asc" ? 1 : -1;

  return (a: RunRow, b: RunRow) => {
    const av = getVal(a, key);
    const bv = getVal(b, key);

    if (key === "run_at") {
      const at = Date.parse(String(av));
      const bt = Date.parse(String(bv));
      if (Number.isFinite(at) && Number.isFinite(bt)) return (at - bt) * mul;
      return String(av).localeCompare(String(bv)) * mul;
    }

    return (safeNum(av) - safeNum(bv)) * mul;
  };
}

function formatInt(n: unknown) {
  const v = safeNum(n);
  try {
    return new Intl.NumberFormat("ru-RU").format(v);
  } catch {
    return String(v);
  }
}

function formatDelta(delta: number) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${formatInt(delta)}`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/* ------------------------------------------
 * Severity / tone
 * ------------------------------------------ */

type Tone = "ok" | "warn" | "bad" | "none";

function severityFrom(last?: RunRow): Tone {
  if (!last) return "none";

  const deficit = safeNum(last?.deficit_products);
  const expiring = safeNum(last?.expiring_products);
  const unmatched = safeNum(last?.unmatched_installs);

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

function glowClasses(kind: Tone) {
  switch (kind) {
    case "ok":
      return "shadow-[0_18px_70px_rgba(16,185,129,0.10)]";
    case "warn":
      return "shadow-[0_18px_70px_rgba(245,158,11,0.10)]";
    case "bad":
      return "shadow-[0_18px_70px_rgba(244,63,94,0.12)]";
    default:
      return "shadow-[0_18px_70px_rgba(34,211,238,0.08)]";
  }
}

/* ------------------------------------------
 * Shared visual tokens (local)
 * ------------------------------------------ */

const SOFT_BORDER = "border-[rgba(100,130,170,0.18)]";
const SOFT_BORDER_HOVER = "hover:border-[rgba(120,155,205,0.28)]";
const SOFT_BORDER_STRONG = "border-[rgba(120,155,205,0.24)]";

const GLASS_BG = "bg-[rgba(var(--card),0.26)]";
const GLASS_BG_SOFT = "bg-[rgba(var(--card),0.18)]";
const GLASS_BG_STRONG =
  "bg-[linear-gradient(to_bottom,rgba(var(--card),0.46),rgba(var(--card),0.22))]";

const SOFT_SHADOW = "shadow-[0_14px_38px_rgba(0,0,0,0.24)]";
const CARD_SHADOW = "shadow-[0_24px_80px_rgba(0,0,0,0.36)]";

/* ------------------------------------------
 * UI atoms
 * ------------------------------------------ */

function SoftButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "primary" | "ghost" | "danger";
  leftIcon?: ReactNode;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
}) {
  const {
    onClick,
    disabled,
    title,
    variant = "ghost",
    leftIcon,
    children,
    className,
    type = "button",
  } = props;

  const base =
    "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold " +
    "transition outline-none active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed " +
    "focus-visible:ring-2 focus-visible:ring-cyan-300/25";

  const v =
    variant === "primary"
      ? [
          "border",
          SOFT_BORDER_STRONG,
          "bg-[linear-gradient(to_bottom,rgba(34,211,238,0.16),rgba(34,211,238,0.05))]",
          "text-[rgb(var(--fg))]",
          "hover:bg-[linear-gradient(to_bottom,rgba(34,211,238,0.22),rgba(34,211,238,0.08))]",
          "shadow-[0_14px_42px_rgba(34,211,238,0.10)]",
        ].join(" ")
      : variant === "danger"
        ? [
            "border",
            SOFT_BORDER,
            "bg-[linear-gradient(to_bottom,rgba(244,63,94,0.14),rgba(244,63,94,0.05))]",
            "text-[rgb(var(--fg))]",
            "hover:bg-[linear-gradient(to_bottom,rgba(244,63,94,0.20),rgba(244,63,94,0.08))]",
            "shadow-[0_14px_42px_rgba(244,63,94,0.10)]",
          ].join(" ")
        : [
            "border",
            SOFT_BORDER,
            GLASS_BG,
            "text-[rgba(var(--fg),0.86)]",
            "hover:bg-[rgba(var(--card),0.38)]",
            SOFT_BORDER_HOVER,
            SOFT_SHADOW,
          ].join(" ");

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(base, v, className)}
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
      ? "bg-emerald-500/10 text-emerald-100"
      : kind === "warn"
        ? "bg-amber-500/10 text-amber-100"
        : kind === "bad"
          ? "bg-rose-500/10 text-rose-100"
          : `${GLASS_BG_SOFT} text-[rgba(var(--fg),0.72)]`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold",
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
  delta,
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  delta?: number | null;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4",
        SOFT_BORDER,
        GLASS_BG_STRONG,
        SOFT_SHADOW,
        glowClasses(tone)
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/14 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-[rgba(var(--fg),0.46)]">
            {icon && <span className="text-[rgba(var(--fg),0.38)]">{icon}</span>}
            <span>{label}</span>
          </div>

          <div className="mt-1 text-2xl font-semibold tracking-tight text-[rgb(var(--fg))] tabular-nums">
            {value}
          </div>
        </div>

        {delta !== undefined && delta !== null && (
          <div
            className={cn(
              "rounded-2xl px-2.5 py-1 text-[12px] font-semibold tabular-nums",
              delta > 0
                ? "bg-rose-500/10 text-rose-100"
                : delta < 0
                  ? "bg-emerald-500/10 text-emerald-100"
                  : "bg-[rgba(var(--card),0.26)] text-[rgba(var(--fg),0.64)]"
            )}
            title="Delta vs previous run"
          >
            {delta === 0 ? "±0" : formatDelta(delta)}
          </div>
        )}
      </div>
    </div>
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
      className={cn(
        "group flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition",
        SOFT_BORDER,
        GLASS_BG,
        "hover:bg-[rgba(var(--card),0.34)]",
        SOFT_BORDER_HOVER,
        SOFT_SHADOW,
        "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
      )}
    >
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
          "bg-[rgba(var(--fg),0.04)]"
        )}
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[rgba(var(--fg),0.88)]">
          {label}
        </span>
        {sub && (
          <span className="block truncate text-[11px] text-[rgba(var(--fg),0.46)]">
            {sub}
          </span>
        )}
      </span>

      <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-[rgba(var(--fg),0.30)] transition group-hover:text-[rgba(var(--fg),0.60)]" />
    </a>
  );
}

function SummaryLine({
  label,
  value,
  icon,
  tone = "none",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  const accent =
    tone === "ok"
      ? "from-emerald-300/14"
      : tone === "warn"
        ? "from-amber-300/14"
        : tone === "bad"
          ? "from-rose-300/14"
          : "from-cyan-300/06";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4",
        SOFT_BORDER,
        GLASS_BG_STRONG,
        SOFT_SHADOW
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent",
          accent
        )}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs text-[rgba(var(--fg),0.46)]">
          {icon && <span className="text-[rgba(var(--fg),0.36)]">{icon}</span>}
          <span>{label}</span>
        </div>
        <div className="mt-1 text-sm font-semibold text-[rgba(var(--fg),0.86)] tabular-nums">
          {value}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "none",
}: {
  label: string;
  value: number;
  tone?: Tone;
}) {
  const cls =
    tone === "bad"
      ? "bg-rose-500/10 text-rose-100"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-100"
        : tone === "ok"
          ? "bg-emerald-500/10 text-emerald-100"
          : `${GLASS_BG_SOFT} text-[rgba(var(--fg),0.72)]`;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3",
        SOFT_BORDER,
        cls
      )}
    >
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function KindPill({ kind }: { kind: "new" | "removed" | "changed" | "same" }) {
  const p =
    kind === "new"
      ? { t: "NEW", cls: "bg-cyan-500/10 text-cyan-100" }
      : kind === "removed"
        ? { t: "REMOVED", cls: "bg-emerald-500/10 text-emerald-100" }
        : kind === "changed"
          ? { t: "CHANGED", cls: "bg-amber-500/10 text-amber-100" }
          : { t: "—", cls: `${GLASS_BG_SOFT} text-[rgba(var(--fg),0.70)]` };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-2xl px-3 py-1.5 text-[12px] font-semibold",
        p.cls
      )}
    >
      {p.t}
    </span>
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
        <div className="flex items-center gap-2 text-[rgba(var(--fg),0.88)]">
          {icon && <span className="text-cyan-400">{icon}</span>}
          <span className="text-lg font-semibold">{title}</span>
        </div>
        {desc && (
          <div className="mt-1 text-sm text-[rgba(var(--fg),0.50)]">{desc}</div>
        )}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* ------------------------------------------
 * Dashboard
 * ------------------------------------------ */

export default function Dashboard() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("run_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [diffLoading, setDiffLoading] = useState(false);
  const [diffErr, setDiffErr] = useState("");
  const [diff, setDiff] = useState<ReturnType<typeof computeRunDiff> | null>(
    null
  );

  const mounted = useRef(true);

  const orderedRuns = useMemo(() => {
    return [...runs].sort((a, b) => Number(b.id) - Number(a.id));
  }, [runs]);

  const last = orderedRuns[0];
  const prev = orderedRuns[1];

  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const tone = severityFrom(last);

  const kpi = useMemo(() => {
    const lp = last ? safeNum(last?.total_products) : 0;
    const ld = last ? safeNum(last?.deficit_products) : 0;
    const le = last ? safeNum(last?.expiring_products) : 0;
    const lu = last ? safeNum(last?.unmatched_installs) : 0;

    const pp = prev ? safeNum(prev?.total_products) : null;
    const pd = prev ? safeNum(prev?.deficit_products) : null;
    const pe = prev ? safeNum(prev?.expiring_products) : null;
    const pu = prev ? safeNum(prev?.unmatched_installs) : null;

    return {
      total: { v: lp, delta: pp === null ? null : lp - pp },
      deficit: { v: ld, delta: pd === null ? null : ld - pd },
      expiring: { v: le, delta: pe === null ? null : le - pe },
      unmatched: { v: lu, delta: pu === null ? null : lu - pu },
    };
  }, [last, prev]);

  const baseRuns = orderedRuns;

  const sortedRuns = useMemo(() => {
    if (!sortDir) return baseRuns;
    return [...baseRuns].sort(cmpBy(sortKey, sortDir));
  }, [baseRuns, sortKey, sortDir]);

  const toggleSort = (key: SortKey, defaultDir: Exclude<SortDir, null>) => {
    setSortKey(key);
    setSortDir((d) => {
      if (sortKey !== key) return defaultDir;
      return nextDir(d);
    });
  };

  async function refresh() {
    setErr("");
    setLoading(true);
    try {
      const r: RunRow[] = await getRuns();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lastRun = orderedRuns[0];
    const prevRun = orderedRuns[1];

    if (!lastRun || !prevRun) {
      setDiff(null);
      return;
    }

    let alive = true;
    setDiffLoading(true);
    setDiffErr("");

    Promise.all([getRunResults(lastRun.id), getRunResults(prevRun.id)])
      .then(([nowRows, prevRows]) => {
        if (!alive) return;
        setDiff(computeRunDiff(nowRows, prevRows));
      })
      .catch((e) => {
        if (!alive) return;
        setDiffErr(String(e?.message ?? e));
      })
      .finally(() => {
        if (!alive) return;
        setDiffLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [orderedRuns]);

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

      toast.push({
        tone: "success",
        title: "Готово",
        message: "Проверка успешно завершена. Обновляю дашборд…",
      });

      await refresh();
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

  async function onCopyLastId() {
    if (!last) return;

    const ok = await navigator.clipboard
      .writeText(String(last.id))
      .then(() => true)
      .catch(() => false);

    toast.push({
      tone: ok ? "success" : "warning",
      title: ok ? "Скопировано" : "Не удалось",
      message: ok
        ? `ID #${last.id} в буфере обмена.`
        : "Браузер запретил доступ к clipboard.",
      duration: 2200,
    });
  }

  const heroTitle =
    tone === "ok"
      ? "Система в порядке"
      : tone === "warn"
        ? "Есть риски"
        : tone === "bad"
          ? "Нужны действия"
          : "Добро пожаловать";

  const heroSubtitle =
    tone === "ok"
      ? "Дефицитов нет. Можно жить спокойно."
      : tone === "warn"
        ? "Есть истекающие или unmatched — проверь отчёты."
        : tone === "bad"
          ? "Обнаружены дефициты — срочно разберись."
          : isAdmin
            ? "Запусти первую проверку, чтобы увидеть состояние."
            : "Ожидается первый запуск проверки, чтобы показать состояние системы.";

  const heroAccent =
    tone === "ok"
      ? "from-emerald-300/14 via-cyan-300/08 to-transparent"
      : tone === "warn"
        ? "from-amber-300/14 via-cyan-300/08 to-transparent"
        : tone === "bad"
          ? "from-rose-300/14 via-cyan-300/08 to-transparent"
          : "from-cyan-300/12 via-white/5 to-transparent";

  const topDiffItems = useMemo(() => {
    if (!diff) return [];
    return [...diff.items]
      .filter((x) => x.kind !== "same")
      .sort((a, b) => diffScore(b) - diffScore(a))
      .slice(0, 8);
  }, [diff]);

  return (
    <div className="space-y-6">
      {/* HERO */}
      <Card
        className={cn(
          "relative overflow-hidden rounded-3xl p-5 md:p-6",
          "bg-[linear-gradient(to_bottom,rgba(var(--bg),0.74),rgba(var(--bg),0.36))]",
          CARD_SHADOW
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-r",
            heroAccent
          )}
        />
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 top-0 h-72 w-72 rounded-full bg-indigo-500/8 blur-3xl" />

        <div className="relative space-y-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div
                className={cn(
                  "grid h-14 w-14 shrink-0 place-items-center rounded-3xl",
                  "bg-[rgba(var(--fg),0.04)]",
                  glowClasses(tone)
                )}
              >
                {tone === "ok" ? (
                  <CircleCheck className="h-7 w-7 text-emerald-300/90" />
                ) : tone === "warn" ? (
                  <TriangleAlert className="h-7 w-7 text-amber-300/90" />
                ) : tone === "bad" ? (
                  <TriangleAlert className="h-7 w-7 text-rose-300/90" />
                ) : (
                  <Sparkles className="h-7 w-7 text-cyan-300/85" />
                )}
              </div>

              <div className="min-w-0">
                <div className="text-xs tracking-wide text-[rgba(var(--fg),0.46)]">
                  License Monitor
                </div>

                <div className="mt-1 text-3xl font-semibold tracking-tight text-[rgb(var(--fg))]">
                  {heroTitle}
                </div>

                <div className="mt-2 max-w-[72ch] text-sm leading-relaxed text-[rgba(var(--fg),0.58)]">
                  {heroSubtitle}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusChip kind={tone}>
                    {tone === "ok"
                      ? "OK"
                      : tone === "warn"
                        ? "WARN"
                        : tone === "bad"
                          ? "BAD"
                          : "NO RUNS"}
                  </StatusChip>

                  {last && (
                    <span className="inline-flex items-center gap-2 text-[12px] text-[rgba(var(--fg),0.46)]">
                      <Clock className="h-4 w-4" />
                      <span>Последний запуск: {String(last.run_at)}</span>
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
                  title="Запустить проверку"
                >
                  {busy ? "Запускаю..." : "Запустить"}
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
                title="Обновить"
              >
                Обновить
              </SoftButton>

              {last && (
                <>
                  <SoftButton
                    onClick={onCopyLastId}
                    disabled={busy}
                    leftIcon={<Copy className="h-4 w-4" />}
                    title="Скопировать ID последнего запуска"
                  >
                    ID
                  </SoftButton>

                  <Link
                    to={`/runs/${last.id}`}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold",
                      SOFT_BORDER,
                      GLASS_BG,
                      "text-[rgba(var(--fg),0.86)]",
                      "hover:bg-[rgba(var(--card),0.38)]",
                      SOFT_BORDER_HOVER,
                      SOFT_SHADOW,
                      "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                    )}
                    title="Открыть последний запуск"
                  >
                    Открыть #{last.id}
                    <ArrowUpRight className="h-4 w-4 text-[rgba(var(--fg),0.50)]" />
                  </Link>
                </>
              )}
            </div>
          </div>

          {err && (
            <div className="rounded-2xl bg-rose-500/10 px-4 py-3">
              <div className="text-sm font-semibold text-rose-100">Ошибка</div>
              <div className="mt-1 break-words text-xs text-rose-200/80">
                {err}
              </div>
            </div>
          )}

          {!isAdmin && (
            <div className={cn("rounded-2xl px-4 py-3", GLASS_BG_SOFT)}>
              <div className="text-sm font-semibold text-[rgba(var(--fg),0.86)]">
                Режим просмотра
              </div>
              <div className="mt-1 text-xs text-[rgba(var(--fg),0.56)]">
                У вас нет прав на запуск новых проверок. Доступен просмотр истории
                и скачивание отчётов.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <HeroMetric
              label="Продуктов"
              value={formatInt(kpi.total.v)}
              tone="none"
              delta={kpi.total.delta}
              icon={<Layers className="h-4 w-4" />}
            />
            <HeroMetric
              label="Дефицитов"
              value={formatInt(kpi.deficit.v)}
              tone={kpi.deficit.v > 0 ? "bad" : "ok"}
              delta={kpi.deficit.delta}
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <HeroMetric
              label="Истекающих"
              value={formatInt(kpi.expiring.v)}
              tone={kpi.expiring.v > 0 ? "warn" : "ok"}
              delta={kpi.expiring.delta}
              icon={<TimerReset className="h-4 w-4" />}
            />
            <HeroMetric
              label="Unmatched"
              value={formatInt(kpi.unmatched.v)}
              tone={kpi.unmatched.v > 0 ? "warn" : "ok"}
              delta={kpi.unmatched.delta}
              icon={<Zap className="h-4 w-4" />}
            />
          </div>
        </div>
      </Card>

      {/* EXPORTS */}
      <Card className={cn("rounded-3xl p-5", CARD_SHADOW)}>
        <SectionHeader
          icon={<FolderOutput className="h-5 w-5" />}
          title="Reports & exports"
          desc="Быстрый доступ к основным файлам отчёта."
        />

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <DownloadTile
            href={download.xlsx}
            label="Excel"
            sub="Сводная таблица"
            icon={<FileSpreadsheet className="h-4 w-4 text-cyan-300/85" />}
          />
          <DownloadTile
            href={download.reportCsv}
            label="report.csv"
            sub="Отчёт по продуктам"
            icon={<FileText className="h-4 w-4 text-cyan-300/85" />}
          />
          <DownloadTile
            href={download.runsCsv}
            label="runs.csv"
            sub="История запусков"
            icon={<DownloadIcon className="h-4 w-4 text-cyan-300/85" />}
          />
          <DownloadTile
            href={download.unmatchedCsv}
            label="unmatched.csv"
            sub="Несопоставленные установки"
            icon={<DownloadIcon className="h-4 w-4 text-cyan-300/85" />}
          />
          <DownloadTile
            href={download.badRowsCsv}
            label="bad_rows.csv"
            sub="Проблемные строки"
            icon={<DownloadIcon className="h-4 w-4 text-cyan-300/85" />}
          />
        </div>
      </Card>

      {/* SUMMARY + DIFF */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <Card className={cn("rounded-3xl p-5", CARD_SHADOW)}>
          <SectionHeader
            icon={<Clock className="h-5 w-5" />}
            title="Последний запуск"
            desc="Быстрый обзор и переход в детали."
            right={
              last ? (
                <Link
                  to={`/runs/${last.id}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2",
                    SOFT_BORDER,
                    GLASS_BG,
                    "hover:bg-[rgba(var(--card),0.38)]",
                    SOFT_BORDER_HOVER,
                    "transition"
                  )}
                >
                  <span className="text-sm font-semibold text-[rgba(var(--fg),0.86)]">
                    Открыть #{last.id}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[rgba(var(--fg),0.46)]" />
                </Link>
              ) : (
                <StatusChip kind="none">Нет данных</StatusChip>
              )
            }
          />

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <SummaryLine
              label="Дата"
              value={last ? String(last.run_at) : "—"}
              icon={<Clock className="h-4 w-4" />}
            />
            <SummaryLine
              label="Продуктов"
              value={last ? formatInt(last?.total_products) : "—"}
              tone="none"
              icon={<Layers className="h-4 w-4" />}
            />
            <SummaryLine
              label="Дефицитов"
              value={last ? formatInt(last?.deficit_products) : "—"}
              tone={last && safeNum(last?.deficit_products) > 0 ? "bad" : "ok"}
              icon={<ShieldCheck className="h-4 w-4" />}
            />
            <SummaryLine
              label="Истекающих"
              value={last ? formatInt(last?.expiring_products) : "—"}
              tone={last && safeNum(last?.expiring_products) > 0 ? "warn" : "ok"}
              icon={<TimerReset className="h-4 w-4" />}
            />
            <SummaryLine
              label="Unmatched"
              value={last ? formatInt(last?.unmatched_installs) : "—"}
              tone={last && safeNum(last?.unmatched_installs) > 0 ? "warn" : "ok"}
              icon={<Zap className="h-4 w-4" />}
            />
            <SummaryLine
              label="Предыдущий запуск"
              value={prev ? `#${prev.id}` : "—"}
              icon={<ChevronRight className="h-4 w-4" />}
            />
          </div>
        </Card>

        <Card className={cn("rounded-3xl p-5", CARD_SHADOW)}>
          <SectionHeader
            icon={<Activity className="h-5 w-5" />}
            title="Изменения с прошлого запуска"
            desc="Последний прогон против предыдущего."
            right={
              <div className="text-[11px] text-[rgba(var(--fg),0.45)]">
                {diffLoading
                  ? "Считаю diff…"
                  : diff
                    ? `Δ items: ${diff.items.length}`
                    : "—"}
              </div>
            }
          />

          {diffLoading ? (
            <div className="mt-4">
              <TableSkeleton rows={5} cols={4} />
            </div>
          ) : diffErr ? (
            <div className="mt-4">
              <TableEmpty title="Не удалось посчитать diff" description={diffErr} />
            </div>
          ) : !diff ? (
            <div className="mt-4">
              <TableEmpty
                title="Недостаточно данных"
                description="Нужны минимум два запуска, чтобы построить diff."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MiniStat
                  label="Новые строки"
                  value={diff.counts.newRows}
                  tone={diff.counts.newRows ? "warn" : "ok"}
                />
                <MiniStat
                  label="Исчезли"
                  value={diff.counts.removedRows}
                  tone="ok"
                />
                <MiniStat
                  label="Ухудшилось"
                  value={diff.counts.worsened}
                  tone={diff.counts.worsened ? "bad" : "ok"}
                />
                <MiniStat
                  label="Улучшилось"
                  value={diff.counts.improved}
                  tone="ok"
                />
                <MiniStat
                  label="Новые expires"
                  value={diff.counts.expiresNew}
                  tone={diff.counts.expiresNew ? "warn" : "ok"}
                />
              </div>

              <div
                className={cn(
                  "rounded-3xl border p-3",
                  SOFT_BORDER,
                  "bg-[rgba(var(--card),0.12)]"
                )}
              >
                {topDiffItems.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-[rgba(var(--fg),0.52)]">
                    Значимых изменений нет.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topDiffItems.map((x) => (
                      <div
                        key={x.key}
                        className={cn(
                          "grid grid-cols-1 gap-3 rounded-2xl border p-3",
                          SOFT_BORDER,
                          GLASS_BG_SOFT,
                          "md:grid-cols-[auto_minmax(0,1fr)_auto_auto]"
                        )}
                      >
                        <div>
                          <KindPill kind={x.kind} />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[rgba(var(--fg),0.88)]">
                            {x.product}
                          </div>
                          <div className="mt-0.5 truncate text-[12px] text-[rgba(var(--fg),0.48)]">
                            {x.license_type}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            x.delta_now < x.delta_prev
                              ? "text-rose-200"
                              : x.delta_now > x.delta_prev
                                ? "text-emerald-200"
                                : "text-[rgba(var(--fg),0.74)]"
                          )}
                        >
                          {x.delta_prev} → {x.delta_now}
                        </div>

                        <div className="text-sm tabular-nums text-[rgba(var(--fg),0.66)]">
                          {x.demand_now}/{x.licenses_now}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* FULL DIFF TABLE */}
      <Card className={cn("rounded-3xl overflow-hidden p-0", CARD_SHADOW)}>
        <Table>
          <TableCaption
            title="Подробный diff"
            description="Топ-30 изменений между последним и предыдущим запуском."
            right={
              <div className="text-[11px] text-[rgba(var(--fg),0.45)]">
                {diffLoading
                  ? "Считаю diff…"
                  : diff
                    ? `Δ items: ${diff.items.length}`
                    : "—"}
              </div>
            }
          />

          {diffLoading ? (
            <TableSkeleton rows={7} cols={6} />
          ) : diffErr ? (
            <TableEmpty title="Не удалось посчитать diff" description={diffErr} />
          ) : !diff ? (
            <TableEmpty
              title="Недостаточно данных"
              description="Нужны минимум два запуска, чтобы построить diff."
            />
          ) : (
            <div className="px-4 pb-4">
              <div className="mt-3">
                <TableScroll className="max-h-[50vh]">
                  <TableInner stickyHeader density="comfortable">
                    <THead>
                      <tr>
                        <SortTh label="kind" dir={null} />
                        <SortTh label="product" dir={null} />
                        <SortTh label="license_type" dir={null} />
                        <SortTh label="delta" dir={null} />
                        <SortTh label="expires" dir={null} />
                        <SortTh label="demand/licenses" dir={null} />
                      </tr>
                    </THead>

                    <TBody>
                      {[...diff.items]
                        .filter((x) => x.kind !== "same")
                        .sort((a, b) => diffScore(b) - diffScore(a))
                        .slice(0, 30)
                        .map((x) => (
                          <Tr key={x.key}>
                            <Td>
                              <KindPill kind={x.kind} />
                            </Td>

                            <Td className="font-semibold text-[rgba(var(--fg),0.86)]">
                              {x.product}
                            </Td>

                            <Td className="text-[rgba(var(--fg),0.70)]">
                              {x.license_type}
                            </Td>

                            <Td
                              className={cn(
                                "font-semibold tabular-nums",
                                x.delta_now < x.delta_prev
                                  ? "text-rose-200"
                                  : x.delta_now > x.delta_prev
                                    ? "text-emerald-200"
                                    : "text-[rgba(var(--fg),0.74)]"
                              )}
                            >
                              {x.delta_prev} → {x.delta_now}
                            </Td>

                            <Td className="text-[rgba(var(--fg),0.74)]">
                              {x.expires_prev === x.expires_now ? (
                                <span className="text-[rgba(var(--fg),0.50)]">—</span>
                              ) : x.expires_now ? (
                                <span className="font-semibold text-amber-200">
                                  became YES
                                </span>
                              ) : (
                                <span className="font-semibold text-emerald-200">
                                  became NO
                                </span>
                              )}
                            </Td>

                            <Td className="tabular-nums text-[rgba(var(--fg),0.74)]">
                              {x.demand_prev}/{x.licenses_prev} → {x.demand_now}/
                              {x.licenses_now}
                            </Td>
                          </Tr>
                        ))}
                    </TBody>
                  </TableInner>
                </TableScroll>
              </div>

              <div className="mt-3 text-[12px] text-[rgba(var(--fg),0.45)]">
                Показаны топ-30 изменений. Полный diff можно вынести на отдельную
                страницу позже.
              </div>
            </div>
          )}
        </Table>
      </Card>

      {/* RUNS TABLE */}
      <Card className={cn("rounded-3xl overflow-hidden p-0", CARD_SHADOW)}>
        <Table>
          <TableCaption
            title="Последние запуски"
            description="История прогонов. Сортируй по колонкам."
            right={
              <div className="text-[11px] text-[rgba(var(--fg),0.45)]">
                {loading
                  ? "Обновляю…"
                  : `Показано: ${clamp(sortedRuns.length, 0, 50)}`}
              </div>
            }
          />

          {loading ? (
            <TableSkeleton rows={7} cols={6} />
          ) : sortedRuns.length === 0 ? (
            <TableEmpty
              title="Запусков пока нет"
              description={
                isAdmin
                  ? "Нажми «Запустить», чтобы создать первый прогон."
                  : "История запусков пока пуста."
              }
            />
          ) : (
            <TableScroll className="max-h-[62vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    <SortTh
                      label="id"
                      dir={sortKey === "id" ? sortDir : null}
                      onToggle={() => toggleSort("id", "asc")}
                      hint="Sort by id"
                    />
                    <SortTh
                      label="run_at"
                      dir={sortKey === "run_at" ? sortDir : null}
                      onToggle={() => toggleSort("run_at", "desc")}
                      hint="Sort by run time"
                    />
                    <SortTh
                      label="products"
                      dir={sortKey === "total_products" ? sortDir : null}
                      onToggle={() => toggleSort("total_products", "desc")}
                      hint="Sort by total products"
                    />
                    <SortTh
                      label="deficit"
                      dir={sortKey === "deficit_products" ? sortDir : null}
                      onToggle={() => toggleSort("deficit_products", "desc")}
                      hint="Sort by deficits"
                    />
                    <SortTh
                      label="expiring"
                      dir={sortKey === "expiring_products" ? sortDir : null}
                      onToggle={() => toggleSort("expiring_products", "desc")}
                      hint="Sort by expiring"
                    />
                    <SortTh
                      label="unmatched"
                      dir={sortKey === "unmatched_installs" ? sortDir : null}
                      onToggle={() => toggleSort("unmatched_installs", "desc")}
                      hint="Sort by unmatched installs"
                    />
                  </tr>
                </THead>

                <TBody>
                  {sortedRuns.slice(0, 50).map((r) => {
                    const deficit = safeNum(r.deficit_products);
                    const expiring = safeNum(r.expiring_products);
                    const unmatched = safeNum(r.unmatched_installs);

                    const rowTone: Tone =
                      deficit > 0
                        ? "bad"
                        : expiring > 0 || unmatched > 0
                          ? "warn"
                          : "ok";

                    return (
                      <Tr key={r.id}>
                        <Td>
                          <Link
                            className={cn(
                              "inline-flex items-center gap-2 font-semibold hover:underline underline-offset-4",
                              rowTone === "bad"
                                ? "text-rose-200/90 hover:text-rose-200"
                                : rowTone === "warn"
                                  ? "text-amber-200/90 hover:text-amber-200"
                                  : "text-cyan-200/90 hover:text-cyan-200"
                            )}
                            to={`/runs/${r.id}`}
                          >
                            #{r.id}
                            <span className="text-[11px] font-normal text-[rgba(var(--fg),0.34)]">
                              details
                            </span>
                          </Link>
                        </Td>

                        <Td className="text-[rgba(var(--fg),0.70)]">
                          {String(r.run_at)}
                        </Td>

                        <Td className="tabular-nums">
                          {formatInt(r.total_products)}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums",
                            deficit > 0 ? "text-rose-200" : "text-[rgba(var(--fg),0.74)]"
                          )}
                        >
                          {formatInt(deficit)}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums",
                            expiring > 0 ? "text-amber-200" : "text-[rgba(var(--fg),0.74)]"
                          )}
                        >
                          {formatInt(expiring)}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums",
                            unmatched > 0 ? "text-amber-200" : "text-[rgba(var(--fg),0.74)]"
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