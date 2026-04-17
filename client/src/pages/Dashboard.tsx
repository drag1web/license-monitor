import { useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";

/**
 * ==========================================
 *  Dashboard — "Luxury glass" edition
 * ==========================================
 * - Hero summary (last run)
 * - Quick actions
 * - KPI cards (+ deltas)
 * - Downloads grid
 * - Diff vs previous run (KPI + top changes)
 * - Recent runs table (sorting)
 * - Polished states: loading/busy/error/empty
 */

/* ------------------------------------------
 *  Table sorting (runs)
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

    // numeric-ish
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
 *  Severity logic (hero / badges / glows)
 * ------------------------------------------ */

type Tone = "ok" | "warn" | "bad" | "none";

function severityFrom(last?: RunRow): Tone {
  if (!last) return "none";

  const deficit = safeNum(last?.deficit_products);
  const expiring = safeNum(last?.expiring_products);
  const unmatched = safeNum(last?.unmatched_installs);

  // tune thresholds as you like
  if (deficit > 0) return "bad";
  if (expiring > 0 || unmatched > 0) return "warn";
  return "ok";
}

function badgeClasses(kind: Tone) {
  switch (kind) {
    case "ok":
      return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
    case "warn":
      return "border-amber-300/20 bg-amber-500/10 text-amber-100";
    case "bad":
      return "border-rose-300/20 bg-rose-500/10 text-rose-100";
    default:
      return "border-white/10 bg-white/[0.03] text-white/70";
  }
}

function glowClasses(kind: Tone) {
  switch (kind) {
    case "ok":
      return "shadow-[0_18px_90px_rgba(16,185,129,0.12)]";
    case "warn":
      return "shadow-[0_18px_90px_rgba(245,158,11,0.12)]";
    case "bad":
      return "shadow-[0_18px_90px_rgba(244,63,94,0.14)]";
    default:
      return "shadow-[0_18px_90px_rgba(34,211,238,0.10)]";
  }
}

function iconForTone(kind: Tone) {
  if (kind === "ok") return <CircleCheck className="h-4 w-4" />;
  if (kind === "warn") return <TriangleAlert className="h-4 w-4" />;
  if (kind === "bad") return <TriangleAlert className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

// async function copyText(text: string) {
//   try {
//     await navigator.clipboard.writeText(text);
//     return true;
//   } catch {
//     return false;
//   }
// }

/* ------------------------------------------
 *  Small UI atoms (kept inside this file)
 * ------------------------------------------ */

function SoftButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "primary" | "ghost" | "danger";
  leftIcon?: React.ReactNode;
  children: React.ReactNode;
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
      ? "bg-gradient-to-b from-cyan-300/16 to-cyan-300/6 border border-cyan-200/20 text-white/90 hover:bg-cyan-300/22 shadow-[0_14px_55px_rgba(34,211,238,0.12)]"
      : variant === "danger"
        ? "bg-gradient-to-b from-rose-400/16 to-rose-400/6 border border-rose-200/20 text-white/90 hover:bg-rose-400/22 shadow-[0_14px_55px_rgba(244,63,94,0.12)]"
        : "bg-white/[0.03] border border-white/[0.08] text-white/80 hover:bg-white/[0.06] shadow-[0_14px_55px_rgba(0,0,0,0.35)]";

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

function Chip({
  children,
  kind = "none",
  className,
}: {
  children: React.ReactNode;
  kind?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border",
        badgeClasses(kind),
        className
      )}
    >
      {iconForTone(kind)}
      {children}
    </span>
  );
}

function StatCard(props: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: Tone;
  delta?: number | null;
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const { label, value, hint, tone = "none", delta, icon, onClick } = props;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.08]",
        "bg-gradient-to-b from-white/[0.06] to-white/[0.02]",
        "p-4 transition",
        "hover:bg-white/[0.07] hover:border-white/[0.12]",
        onClick && "cursor-pointer",
        glowClasses(tone)
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-300/10 blur-2xl opacity-0 group-hover:opacity-100 transition" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-white/45">
            {icon && <span className="text-white/35">{icon}</span>}
            <span>{label}</span>
          </div>

          <div className="mt-1 text-2xl font-semibold tracking-tight text-white/90 tabular-nums">
            {value}
          </div>

          {hint && (
            <div className="mt-1 text-[12px] text-white/45 leading-snug">
              {hint}
            </div>
          )}
        </div>

        {delta !== undefined && delta !== null && (
          <div
            className={cn(
              "rounded-2xl border px-2.5 py-1 text-[12px] font-semibold tabular-nums",
              delta > 0
                ? "border-rose-200/15 bg-rose-500/10 text-rose-100"
                : delta < 0
                  ? "border-emerald-200/15 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-white/65"
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

function DownloadLink({
  href,
  label,
  icon,
  sub,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group inline-flex items-center gap-3 rounded-2xl px-3.5 py-2",
        "bg-white/[0.03] border border-white/[0.08]",
        "hover:bg-white/[0.06] hover:border-white/[0.12]",
        "transition shadow-[0_14px_55px_rgba(0,0,0,0.35)]",
        "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
      )}
    >
      <span
        className={cn(
          "h-9 w-9 rounded-2xl grid place-items-center",
          "bg-gradient-to-b from-white/[0.06] to-white/[0.02]",
          "border border-white/[0.08]"
        )}
      >
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white/85 leading-tight">
          {label}
        </span>
        {sub && (
          <span className="block text-[11px] text-white/45 leading-tight">
            {sub}
          </span>
        )}
      </span>

      <ArrowUpRight className="ml-auto h-4 w-4 text-white/30 group-hover:text-white/60 transition" />
    </a>
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
      ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
      : tone === "warn"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : tone === "ok"
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          : "border-white/10 bg-white/[0.03] text-white/70";

  return (
    <div className={cn("rounded-2xl border px-4 py-3", cls)}>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function KindPill({ kind }: { kind: "new" | "removed" | "changed" | "same" }) {
  const p =
    kind === "new"
      ? { t: "NEW", cls: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100" }
      : kind === "removed"
        ? {
          t: "REMOVED",
          cls: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
        }
        : kind === "changed"
          ? {
            t: "CHANGED",
            cls: "border-amber-300/20 bg-amber-500/10 text-amber-100",
          }
          : { t: "—", cls: "border-white/10 bg-white/[0.03] text-white/70" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-2xl px-3 py-1.5 text-[12px] font-semibold border",
        p.cls
      )}
    >
      {p.t}
    </span>
  );
}

function InfoLine({
  label,
  value,
  icon,
  tone = "none",
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
}) {
  const accent =
    tone === "ok"
      ? "from-emerald-300/18"
      : tone === "warn"
        ? "from-amber-300/18"
        : tone === "bad"
          ? "from-rose-300/18"
          : "from-cyan-300/10";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08]",
        "bg-gradient-to-b from-white/[0.05] to-white/[0.02]",
        "p-4"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent",
          accent
        )}
      />
      <div className="relative">
        <div className="flex items-center gap-2 text-xs text-white/45">
          {icon && <span className="text-white/35">{icon}</span>}
          <span>{label}</span>
        </div>
        <div className="mt-1 text-sm font-semibold text-white/85 tabular-nums">
          {value}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------
 *  Dashboard
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
    // гарантируем: самый новый по id сверху
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

  const baseRuns = orderedRuns; // гарантируем "последние" корректно

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

  // Diff vs prev: load results for last & prev
  useEffect(() => {
    const last = orderedRuns[0];
    const prev = orderedRuns[1];

    if (!last || !prev) {
      setDiff(null);
      return;
    }

    let alive = true;
    setDiffLoading(true);
    setDiffErr("");

    Promise.all([getRunResults(last.id), getRunResults(prev.id)])
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
    const ok = await navigator.clipboard.writeText(String(last.id)).then(() => true).catch(() => false);

    toast.push({
      tone: ok ? "success" : "warning",
      title: ok ? "Скопировано" : "Не удалось",
      message: ok ? `ID #${last.id} в буфере обмена.` : "Браузер запретил доступ к clipboard.",
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
      ? "from-emerald-300/18 via-cyan-300/10 to-transparent"
      : tone === "warn"
        ? "from-amber-300/18 via-cyan-300/10 to-transparent"
        : tone === "bad"
          ? "from-rose-300/18 via-cyan-300/10 to-transparent"
          : "from-cyan-300/16 via-white/6 to-transparent";

  return (
    <div className="space-y-4">
      {/* HERO */}
      <Card
        className={cn(
          "relative overflow-hidden rounded-3xl p-5",
          "border border-white/[0.08]",
          "bg-gradient-to-b from-slate-950/70 via-slate-950/45 to-slate-950/25",
          "backdrop-blur-xl",
          "shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-r",
            heroAccent
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col xl:flex-row xl:items-start gap-4">
            {/* Left hero content */}
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div
                className={cn(
                  "h-12 w-12 rounded-3xl grid place-items-center",
                  "bg-white/[0.04] border border-white/[0.10]",
                  glowClasses(tone)
                )}
              >
                {tone === "ok" ? (
                  <CircleCheck className="h-6 w-6 text-emerald-200/90" />
                ) : tone === "warn" ? (
                  <TriangleAlert className="h-6 w-6 text-amber-200/90" />
                ) : tone === "bad" ? (
                  <TriangleAlert className="h-6 w-6 text-rose-200/90" />
                ) : (
                  <Clock className="h-6 w-6 text-cyan-200/80" />
                )}
              </div>

              <div className="min-w-0">
                <div className="text-xs text-white/50 tracking-wide">
                  License Monitor
                </div>

                <div className="mt-1 text-2xl font-semibold tracking-tight text-white/90">
                  {heroTitle}
                </div>

                <div className="mt-1 text-sm text-white/55 max-w-[70ch]">
                  {heroSubtitle}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Chip kind={tone}>
                    {tone === "ok"
                      ? "OK"
                      : tone === "warn"
                        ? "WARN"
                        : tone === "bad"
                          ? "BAD"
                          : "NO RUNS"}
                  </Chip>

                  {last && (
                    <span className="inline-flex items-center gap-2 text-[12px] text-white/45">
                      <Clock className="h-4 w-4" />
                      <span>Последний запуск: {String(last.run_at)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right actions */}
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
                      "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
                      "bg-white/[0.03] border border-white/[0.08]",
                      "hover:bg-white/[0.06] hover:border-white/[0.12]",
                      "transition shadow-[0_14px_55px_rgba(0,0,0,0.35)]",
                      "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                    )}
                    title="Открыть последний запуск"
                  >
                    Открыть #{last.id}
                    <ArrowUpRight className="h-4 w-4 text-white/55" />
                  </Link>
                </>
              )}
            </div>
          </div>

          {err && (
            <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
              <div className="text-sm font-semibold text-rose-100">Ошибка</div>
              <div className="mt-1 text-xs text-rose-200/80 break-words">
                {err}
              </div>
            </div>
          )}

          {!isAdmin && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-sm font-semibold text-white/85">Режим просмотра</div>
              <div className="mt-1 text-xs text-white/55">
                У вас нет прав на запуск новых проверок. Доступен просмотр истории и скачивание отчётов.
              </div>
            </div>
          )}

          {/* Downloads */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
            <DownloadLink
              href={download.xlsx}
              label="Excel"
              sub="Сводная таблица"
              icon={<FileSpreadsheet className="h-4 w-4 text-cyan-200/85" />}
            />
            <DownloadLink
              href={download.reportCsv}
              label="report.csv"
              sub="Отчёт по продуктам"
              icon={<FileText className="h-4 w-4 text-cyan-200/85" />}
            />
            <DownloadLink
              href={download.runsCsv}
              label="runs.csv"
              sub="История запусков"
              icon={<DownloadIcon className="h-4 w-4 text-cyan-200/85" />}
            />
            <DownloadLink
              href={download.unmatchedCsv}
              label="unmatched.csv"
              sub="Несопоставленные установки"
              icon={<DownloadIcon className="h-4 w-4 text-cyan-200/85" />}
            />
            <DownloadLink
              href={download.badRowsCsv}
              label="bad_rows.csv"
              sub="Проблемные строки"
              icon={<DownloadIcon className="h-4 w-4 text-cyan-200/85" />}
            />
          </div>
        </div>
      </Card>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Продуктов"
          value={formatInt(kpi.total.v)}
          hint="Всего найдено продуктов в последнем прогоне"
          tone="none"
          delta={kpi.total.delta}
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard
          label="Дефицитов"
          value={formatInt(kpi.deficit.v)}
          hint="Лицензий меньше, чем установок"
          tone={kpi.deficit.v > 0 ? "bad" : "ok"}
          delta={kpi.deficit.delta}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Истекающих"
          value={formatInt(kpi.expiring.v)}
          hint="Скоро истекают — продли заранее"
          tone={kpi.expiring.v > 0 ? "warn" : "ok"}
          delta={kpi.expiring.delta}
          icon={<TimerReset className="h-4 w-4" />}
        />
        <StatCard
          label="Unmatched"
          value={formatInt(kpi.unmatched.v)}
          hint="Установки без соответствий"
          tone={kpi.unmatched.v > 0 ? "warn" : "ok"}
          delta={kpi.unmatched.delta}
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      {/* LAST RUN DETAILS */}
      <Card className="p-5 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-white/55">Сводка</div>
            <div className="mt-1 text-lg font-semibold text-white/90">
              Последний запуск
            </div>
            <div className="mt-1 text-sm text-white/50">
              Быстрый обзор и переход в детали.
            </div>
          </div>

          {last ? (
            <Link
              to={`/runs/${last.id}`}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2",
                "bg-white/[0.03] border border-white/[0.08]",
                "hover:bg-white/[0.06] hover:border-white/[0.12]",
                "transition shadow-[0_14px_55px_rgba(0,0,0,0.35)]",
                "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
              )}
            >
              <span className="text-sm font-semibold text-white/85">
                Открыть #{last.id}
              </span>
              <ArrowUpRight className="h-4 w-4 text-white/50" />
            </Link>
          ) : (
            <Chip kind="none">Нет данных</Chip>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <InfoLine
            label="Дата"
            value={last ? String(last.run_at) : "—"}
            icon={<Clock className="h-4 w-4" />}
          />
          <InfoLine
            label="Продуктов"
            value={last ? formatInt(last?.total_products) : "—"}
            tone="none"
          />
          <InfoLine
            label="Дефицитов"
            value={last ? formatInt(last?.deficit_products) : "—"}
            tone={
              last && safeNum(last?.deficit_products) > 0 ? "bad" : "ok"
            }
          />
          <InfoLine
            label="Истекающих"
            value={last ? formatInt(last?.expiring_products) : "—"}
            tone={
              last && safeNum(last?.expiring_products) > 0 ? "warn" : "ok"
            }
          />
        </div>
      </Card>

      {/* DIFF CARD */}
      <Card className="p-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
        <Table>
          <TableCaption
            title="Изменения с прошлого запуска"
            description="Diff: последний прогон vs предыдущий. Самое важное — сверху."
            right={
              <div className="text-[11px] text-white/45">
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
              {/* KPI */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-3">
                <MiniStat
                  label="Новые строки"
                  value={diff.counts.newRows}
                  tone={diff.counts.newRows ? "warn" : "ok"}
                />
                <MiniStat label="Исчезли" value={diff.counts.removedRows} tone="ok" />
                <MiniStat
                  label="Ухудшилось"
                  value={diff.counts.worsened}
                  tone={diff.counts.worsened ? "bad" : "ok"}
                />
                <MiniStat label="Улучшилось" value={diff.counts.improved} tone="ok" />
                <MiniStat
                  label="Новые expires"
                  value={diff.counts.expiresNew}
                  tone={diff.counts.expiresNew ? "warn" : "ok"}
                />
              </div>

              {/* Top changes */}
              <div className="mt-4">
                <TableScroll className="max-h-[52vh]">
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

                            <Td className="font-semibold text-white/85">
                              {x.product}
                            </Td>

                            <Td className="text-white/70">{x.license_type}</Td>

                            <Td
                              className={cn(
                                "tabular-nums font-semibold",
                                x.delta_now < x.delta_prev
                                  ? "text-rose-200"
                                  : x.delta_now > x.delta_prev
                                    ? "text-emerald-200"
                                    : "text-white/75"
                              )}
                            >
                              {x.delta_prev} → {x.delta_now}
                            </Td>

                            <Td className="text-white/75">
                              {x.expires_prev === x.expires_now ? (
                                <span className="text-white/55">—</span>
                              ) : x.expires_now ? (
                                <span className="text-amber-200 font-semibold">
                                  became YES
                                </span>
                              ) : (
                                <span className="text-emerald-200 font-semibold">
                                  became NO
                                </span>
                              )}
                            </Td>

                            <Td className="tabular-nums text-white/75">
                              {x.demand_prev}/{x.licenses_prev} → {x.demand_now}/
                              {x.licenses_now}
                            </Td>
                          </Tr>
                        ))}
                    </TBody>
                  </TableInner>
                </TableScroll>
              </div>

              <div className="mt-3 text-[12px] text-white/45">
                Показаны топ-30 изменений. Полный diff можно вынести на отдельную
                страницу позже.
              </div>
            </div>
          )}
        </Table>
      </Card>

      {/* RUNS TABLE */}
      <Card className="p-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
        <Table>
          <TableCaption
            title="Последние запуски"
            description="История прогонов. Сортируй по колонкам."
            right={
              <div className="text-[11px] text-white/45">
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
                              "inline-flex items-center gap-2 font-semibold",
                              rowTone === "bad"
                                ? "text-rose-200/90 hover:text-rose-200"
                                : rowTone === "warn"
                                  ? "text-amber-200/90 hover:text-amber-200"
                                  : "text-cyan-200/90 hover:text-cyan-200",
                              "hover:underline underline-offset-4"
                            )}
                            to={`/runs/${r.id}`}
                          >
                            #{r.id}
                            <span className="text-[11px] font-normal text-white/35">
                              details
                            </span>
                          </Link>
                        </Td>

                        <Td className="text-white/70">{String(r.run_at)}</Td>

                        <Td className="tabular-nums">
                          {formatInt(r.total_products)}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums",
                            deficit > 0 ? "text-rose-200" : "text-white/75"
                          )}
                        >
                          {formatInt(deficit)}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums",
                            expiring > 0 ? "text-amber-200" : "text-white/75"
                          )}
                        >
                          {formatInt(expiring)}
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums",
                            unmatched > 0 ? "text-amber-200" : "text-white/75"
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
