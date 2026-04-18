import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRunResults, type ResultRow } from "../api";

import { Card } from "../ui/Card";
import { useAuth } from "../auth/AuthContext";
import { ViewerNotice } from "../components/ViewerNotice";
import { cn } from "../ui/cn/cn";
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
  ArrowLeft,
  RefreshCw,
  Search,
  X,
  TriangleAlert,
  CircleCheck,
  Flame,
  Shield,
  ArrowUpRight,
  CalendarClock,
  Layers,
  ShieldAlert,
  TimerReset,
} from "lucide-react";

type SortKey =
  | "risk"
  | "product"
  | "license_type"
  | "demand"
  | "licenses"
  | "delta"
  | "expires_soon"
  | "nearest_end_date";

type SortDir = "asc" | "desc" | null;

type DerivedRisk = "high" | "medium" | "low";

function nextDir(d: SortDir): SortDir {
  if (d === null) return "asc";
  if (d === "asc") return "desc";
  return null;
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normRisk(v: unknown) {
  const s = str(v).trim().toLowerCase();

  // HIGH / DEFICIT / CRITICAL
  if (
    [
      "high",
      "critical",
      "crit",
      "red",
      "🔥",
      "bad",
      "danger",
      "deficit",
    ].includes(s)
  ) {
    return "high";
  }

  // MEDIUM / WARNING / EXPIRING
  if (
    [
      "medium",
      "med",
      "warn",
      "warning",
      "yellow",
      "expiring",
      "expires",
      "expires_soon",
      "soon",
      "watch",
    ].includes(s)
  ) {
    return "medium";
  }

  // LOW / OK
  if (
    [
      "low",
      "ok",
      "green",
      "safe",
      "normal",
    ].includes(s)
  ) {
    return "low";
  }

  if (!s) return "low";

  const n = Number(s);
  if (Number.isFinite(n)) {
    if (n >= 2) return "high";
    if (n >= 1) return "medium";
    return "low";
  }

  return "low";
}

function str(v: unknown) {
  return v === null || v === undefined ? "" : String(v);
}

function formatInt(n: unknown) {
  const v = safeNum(n);
  try {
    return new Intl.NumberFormat("ru-RU").format(v);
  } catch {
    return String(v);
  }
}

function isExpSoon(v: unknown) {
  const s = str(v).trim().toLowerCase();
  if (s === "yes" || s === "y" || s === "true") return true;
  if (s === "no" || s === "n" || s === "false" || s === "—" || s === "") return false;
  return safeNum(v) > 0;
}

/**
 * Источник правды по риску:
 * - delta < 0  => дефицит => HIGH
 * - expires_soon => WARN
 * - иначе OK
 */
function derivedRisk(row: ResultRow): DerivedRisk {
  const delta = safeNum(row.delta);
  const expSoon = isExpSoon(row.expires_soon);

  if (delta < 0) return "high";
  if (expSoon) return "medium";
  return "low";
}

function riskOrder(r: DerivedRisk) {
  if (r === "high") return 3;
  if (r === "medium") return 2;
  return 1;
}

function riskPill(risk: DerivedRisk) {
  if (risk === "high") {
    return {
      label: "HIGH",
      cls: "border-rose-300/20 bg-rose-500/10 text-rose-100",
      icon: <Flame className="h-4 w-4" />,
    };
  }
  if (risk === "medium") {
    return {
      label: "WARN",
      cls: "border-amber-300/20 bg-amber-500/10 text-amber-100",
      icon: <TriangleAlert className="h-4 w-4" />,
    };
  }
  return {
    label: "OK",
    cls: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
    icon: <CircleCheck className="h-4 w-4" />,
  };
}

function cmpBy(key: SortKey, dir: Exclude<SortDir, null>) {
  const mul = dir === "asc" ? 1 : -1;

  return (a: ResultRow, b: ResultRow) => {
    if (key === "risk") {
      return (riskOrder(derivedRisk(a)) - riskOrder(derivedRisk(b))) * mul;
    }

    if (key === "demand" || key === "licenses" || key === "delta") {
      return (safeNum(a[key]) - safeNum(b[key])) * mul;
    }

    if (key === "expires_soon") {
      const aa = isExpSoon(a.expires_soon) ? 1 : 0;
      const bb = isExpSoon(b.expires_soon) ? 1 : 0;
      return (aa - bb) * mul;
    }

    if (key === "nearest_end_date") {
      const at = Date.parse(str(a.nearest_end_date));
      const bt = Date.parse(str(b.nearest_end_date));
      if (Number.isFinite(at) && Number.isFinite(bt)) return (at - bt) * mul;
      return str(a.nearest_end_date).localeCompare(str(b.nearest_end_date)) * mul;
    }

    return str(a[key]).localeCompare(str(b[key])) * mul;
  };
}

function SoftButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "primary" | "ghost";
  leftIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const {
    onClick,
    disabled,
    title,
    variant = "ghost",
    leftIcon,
    children,
    className,
  } = props;

  const base =
    "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold " +
    "transition outline-none active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed " +
    "focus-visible:ring-2 focus-visible:ring-cyan-300/25";

  const v =
    variant === "primary"
      ? "bg-gradient-to-b from-cyan-300/15 to-cyan-300/5 border border-cyan-200/20 text-white/90 hover:bg-cyan-300/20 shadow-[0_14px_50px_rgba(34,211,238,0.12)]"
      : "bg-white/[0.03] border border-white/[0.08] text-white/80 hover:bg-white/[0.06] shadow-[0_14px_50px_rgba(0,0,0,0.35)]";

  return (
    <button
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

function StatCard({
  label,
  value,
  hint,
  tone = "none",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "ok" | "warn" | "bad" | "none";
}) {
  const glow =
    tone === "ok"
      ? "shadow-[0_18px_80px_rgba(16,185,129,0.12)]"
      : tone === "warn"
        ? "shadow-[0_18px_80px_rgba(245,158,11,0.12)]"
        : tone === "bad"
          ? "shadow-[0_18px_80px_rgba(244,63,94,0.14)]"
          : "shadow-[0_18px_80px_rgba(34,211,238,0.08)]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08]",
        "bg-gradient-to-b from-white/[0.06] to-white/[0.02]",
        "p-4",
        glow
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/18 to-transparent" />
      <div className="text-xs text-white/45">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white/90 tabular-nums">
        {value}
      </div>
      {hint && <div className="mt-1 text-[12px] text-white/45">{hint}</div>}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  tone = "none",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "ok" | "warn" | "bad" | "none";
}) {
  const palette =
    tone === "bad"
      ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
      : tone === "warn"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : tone === "ok"
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          : "border-white/10 bg-white/[0.03] text-white/70";

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-[12px] font-semibold border transition",
        active
          ? cn(palette, "ring-2 ring-cyan-300/20")
          : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.05] hover:border-white/[0.12]"
      )}
      title={`Filter: ${label}`}
      type="button"
    >
      {label}
    </button>
  );
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-[12px] font-semibold border transition",
        active
          ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100 ring-2 ring-cyan-300/20"
          : "border-white/[0.08] bg-white/[0.02] text-white/70 hover:bg-white/[0.05] hover:border-white/[0.12]"
      )}
      type="button"
      title={label}
    >
      {label}
    </button>
  );
}

export default function RunDetails() {
  const { id } = useParams();
  const runId = useMemo(() => Number(id), [id]);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [onlyRisk, setOnlyRisk] = useState<"all" | "high" | "medium" | "low">("all");
  const [onlyExpSoon, setOnlyExpSoon] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  async function refresh() {
    if (!Number.isFinite(runId) || runId <= 0) return;

    setErr("");
    setLoading(true);
    try {
      const data = await getRunResults(runId);
      setRows(data ?? []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const stats = useMemo(() => {
    const total = rows.length;

    let high = 0;
    let med = 0;
    let low = 0;
    let expSoon = 0;
    let deficit = 0;

    let sumDemand = 0;
    let sumLic = 0;
    let sumDelta = 0;

    for (const r of rows) {
      const rr = normRisk(r.risk);

      if (rr === "high") high++;
      else if (rr === "medium") med++;
      else if (rr === "low") low++;

      if (str(r.risk).trim().toUpperCase() === "DEFICIT") deficit++;
      if (isExpSoon(r.expires_soon)) expSoon++;

      sumDemand += safeNum(r.demand);
      sumLic += safeNum(r.licenses);
      sumDelta += safeNum(r.delta);
    }

    return {
      total,
      high,
      med,
      low,
      expSoon,
      deficit,
      sumDemand,
      sumLic,
      sumDelta,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      const rr = normRisk(r.risk);

      if (onlyRisk !== "all" && rr !== onlyRisk) return false;
      if (onlyExpSoon && !isExpSoon(r.expires_soon)) return false;

      if (!needle) return true;

      const hay = [
        r.product,
        r.license_type,
        r.nearest_end_date,
        r.delta,
        r.demand,
        r.licenses,
      ]
        .map(str)
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [rows, q, onlyRisk, onlyExpSoon]);

  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    return [...filtered].sort(cmpBy(sortKey, sortDir));
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey, defaultDir: Exclude<SortDir, null>) => {
    setSortKey(key);
    setSortDir((d) => {
      if (sortKey !== key) return defaultDir;
      return nextDir(d);
    });
  };

  const headlineTone =
    stats.high > 0
      ? "bad"
      : stats.med > 0 || stats.expSoon > 0
        ? "warn"
        : rows.length
          ? "ok"
          : "none";

  const heroTitle =
    headlineTone === "bad"
      ? "Есть критичные проблемы"
      : headlineTone === "warn"
        ? "Есть предупреждения"
        : headlineTone === "ok"
          ? "Состояние хорошее"
          : "Нет данных";

  const heroSubtitle =
    headlineTone === "bad"
      ? "В этом запуске есть дефициты или критичные позиции — проверь строки с высоким риском."
      : headlineTone === "warn"
        ? "Есть позиции, требующие внимания: истекающие лицензии и/или средний риск."
        : headlineTone === "ok"
          ? "Критичных проблем не найдено. Можно спокойно жить."
          : "Запусти проверку и вернись сюда.";

  if (!Number.isFinite(runId) || runId <= 0) {
    return (
      <Card className="p-5 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <div className="text-sm font-semibold text-rose-100">Некорректный id</div>
        <div className="mt-1 text-xs text-white/50">
          Проверь URL. Ожидается число &gt; 0.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <ViewerNotice message="У вас нет прав на изменение данных. Доступен только просмотр результатов запуска." />
      )}
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
            "pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent",
            headlineTone === "bad"
              ? "from-rose-300/18 via-cyan-300/10"
              : headlineTone === "warn"
                ? "from-amber-300/18 via-cyan-300/10"
                : headlineTone === "ok"
                  ? "from-emerald-300/18 via-cyan-300/10"
                  : "from-cyan-300/12 via-white/6"
          )}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div
                className={cn(
                  "h-12 w-12 rounded-3xl grid place-items-center",
                  "bg-white/[0.04] border border-white/[0.10]"
                )}
              >
                {headlineTone === "bad" ? (
                  <Flame className="h-6 w-6 text-rose-200/90" />
                ) : headlineTone === "warn" ? (
                  <TriangleAlert className="h-6 w-6 text-amber-200/90" />
                ) : headlineTone === "ok" ? (
                  <CircleCheck className="h-6 w-6 text-emerald-200/90" />
                ) : (
                  <Shield className="h-6 w-6 text-cyan-200/80" />
                )}
              </div>

              <div className="min-w-0">
                <div className="text-xs text-white/50 tracking-wide">Запуск #{runId}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-white/90">
                  {heroTitle}
                </div>
                <div className="mt-1 text-sm text-white/55 max-w-[80ch]">
                  {heroSubtitle}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    to="/runs"
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold",
                      "bg-white/[0.03] border border-white/[0.08]",
                      "hover:bg-white/[0.06] hover:border-white/[0.12]",
                      "transition"
                    )}
                  >
                    <ArrowLeft className="h-4 w-4 text-white/60" />
                    Назад к истории
                  </Link>

                  {rows.length > 0 && (
                    <span className="inline-flex items-center gap-2 text-[12px] text-white/45">
                      <Layers className="h-4 w-4" />
                      <span>Строк: {formatInt(rows.length)}</span>
                    </span>
                  )}

                  {stats.deficit > 0 && (
                    <span className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border border-rose-300/20 bg-rose-500/10 text-rose-100">
                      <ShieldAlert className="h-4 w-4" />
                      Дефицитов: {formatInt(stats.deficit)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                to={`/runs/${runId}/diff`}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
                  "bg-white/[0.03] border border-white/[0.08] text-white/85",
                  "hover:bg-white/[0.06] hover:border-white/[0.12]",
                  "transition shadow-[0_14px_50px_rgba(0,0,0,0.35)]",
                  "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                )}
                title="Сравнить этот запуск с предыдущим"
              >
                <ArrowUpRight className="h-4 w-4 text-cyan-200/80" />
                Сравнение
              </Link>

              <SoftButton
                onClick={() => refresh()}
                disabled={loading}
                leftIcon={<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />}
                title="Обновить"
              >
                Обновить
              </SoftButton>

              <SoftButton
                variant="primary"
                onClick={() => {
                  const el = document.getElementById("results-table");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                disabled={loading}
                leftIcon={<ArrowUpRight className="h-4 w-4" />}
                title="К таблице"
              >
                К таблице
              </SoftButton>
            </div>
          </div>

          {err && (
            <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
              <div className="text-sm font-semibold text-rose-100">Ошибка</div>
              <div className="mt-1 text-xs text-rose-200/80 break-words">{err}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <StatCard label="Высокий риск" value={formatInt(stats.high)} hint="Дефицит / высокий риск" tone={stats.high > 0 ? "bad" : "ok"} />
            <StatCard label="Предупреждения" value={formatInt(stats.med)} hint="Истекающие / средний риск" tone={stats.med > 0 ? "warn" : "ok"} />
            <StatCard label="Скоро истекают" value={formatInt(stats.expSoon)} hint="Лицензии с близким сроком окончания" tone={stats.expSoon > 0 ? "warn" : "ok"} />
            <StatCard label="Суммарная дельта" value={formatInt(stats.sumDelta)} hint="licenses - demand" tone={stats.sumDelta < 0 ? "bad" : stats.sumDelta > 0 ? "ok" : "none"} />
          </div>
        </div>
      </Card>

      {/* FILTER BAR */}
      <Card className="p-4 rounded-3xl border border-white/[0.08] bg-white/[0.02]">
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl px-3 py-2",
              "bg-white/[0.03] border border-white/[0.08]",
              "w-full xl:w-[520px]"
            )}
          >
            <Search className="h-4 w-4 text-white/45" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск: product / license_type / date / delta…"
              className={cn(
                "w-full bg-transparent outline-none",
                "text-sm text-white/85 placeholder:text-white/35"
              )}
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className={cn(
                  "h-8 w-8 grid place-items-center rounded-xl",
                  "hover:bg-white/[0.06] active:bg-white/[0.08]",
                  "transition"
                )}
                title="Очистить"
              >
                <X className="h-4 w-4 text-white/55" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 xl:ml-auto">
            <FilterPill
              label="Все"
              active={onlyRisk === "all"}
              onClick={() => setOnlyRisk("all")}
            />
            <FilterPill
              label="HIGH"
              tone="bad"
              active={onlyRisk === "high"}
              onClick={() => setOnlyRisk("high")}
            />
            <FilterPill
              label="WARN"
              tone="warn"
              active={onlyRisk === "medium"}
              onClick={() => setOnlyRisk("medium")}
            />
            <FilterPill
              label="OK"
              tone="ok"
              active={onlyRisk === "low"}
              onClick={() => setOnlyRisk("low")}
            />
            <TogglePill
              label="Скоро истекают"
              active={onlyExpSoon}
              onClick={() => setOnlyExpSoon((v) => !v)}
            />
          </div>
        </div>

        <div className="mt-3 text-[12px] text-white/45">
          Показано: <span className="font-semibold text-white/70">{formatInt(sorted.length)}</span>{" "}
          из <span className="font-semibold text-white/70">{formatInt(rows.length)}</span>
        </div>
      </Card>

      {/* TABLE */}
      <Card
        id="results-table"
        className="p-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-white/[0.02]"
      >
        <Table>
          <TableCaption
            title={`Результаты запуска #${runId}`}
            description="Сортируй по столбцам. Фильтруй риски, дельту и сроки."
            right={<div className="text-[11px] text-white/45">{loading ? "Обновляю…" : "Готово"}</div>}
          />

          {loading ? (
            <TableSkeleton rows={8} cols={8} />
          ) : err ? (
            <TableEmpty title="Ошибка загрузки" description="Проверь соединение и попробуй обновить." />
          ) : sorted.length === 0 ? (
            <TableEmpty
              title="Ничего не найдено"
              description="Сними фильтры или измени поисковый запрос."
            />
          ) : (
            <TableScroll className="max-h-[70vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    <SortTh
                      label="риск"
                      dir={sortKey === "risk" ? sortDir : null}
                      onToggle={() => toggleSort("risk", "desc")}
                      hint="Сортировать по вычисленному риску"
                    />
                    <SortTh
                      label="продукт"
                      dir={sortKey === "product" ? sortDir : null}
                      onToggle={() => toggleSort("product", "asc")}
                      hint="Сортировать по продукту"
                    />
                    <SortTh
                      label="тип лицензии"
                      dir={sortKey === "license_type" ? sortDir : null}
                      onToggle={() => toggleSort("license_type", "asc")}
                      hint="Сортировать по типу лицензии"
                    />
                    <SortTh
                      label="потребность"
                      dir={sortKey === "demand" ? sortDir : null}
                      onToggle={() => toggleSort("demand", "desc")}
                      hint="Сортировать по потребности"
                    />
                    <SortTh
                      label="лицензии"
                      dir={sortKey === "licenses" ? sortDir : null}
                      onToggle={() => toggleSort("licenses", "desc")}
                      hint="Сортировать по количеству лицензий"
                    />
                    <SortTh
                      label="дельта"
                      dir={sortKey === "delta" ? sortDir : null}
                      onToggle={() => toggleSort("delta", "asc")}
                      hint="Сортировать по дельте"
                    />
                    <SortTh
                      label="скоро истекают"
                      dir={sortKey === "expires_soon" ? sortDir : null}
                      onToggle={() => toggleSort("expires_soon", "desc")}
                      hint="Сортировать по признаку истечения"
                    />
                    <SortTh
                      label="ближайшая дата окончания"
                      dir={sortKey === "nearest_end_date" ? sortDir : null}
                      onToggle={() => toggleSort("nearest_end_date", "asc")}
                      hint="Сортировать по ближайшей дате окончания"
                    />
                  </tr>
                </THead>

                <TBody>
                  {sorted.map((r, idx) => {
                    const rr = normRisk(r.risk);
                    const pill = riskPill(rr);

                    const demand = safeNum(r.demand);
                    const licenses = safeNum(r.licenses);
                    const delta = safeNum(r.delta);
                    const expSoon = isExpSoon(r.expires_soon);

                    return (
                      <Tr key={idx}>
                        <Td>
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border",
                              pill.cls
                            )}
                          >
                            {pill.icon}
                            {pill.label}
                          </span>
                        </Td>

                        <Td className="font-semibold text-white/85">{str(r.product)}</Td>

                        <Td className="text-white/70">{str(r.license_type)}</Td>

                        <Td className="tabular-nums">{formatInt(demand)}</Td>
                        <Td className="tabular-nums">{formatInt(licenses)}</Td>

                        <Td
                          className={cn(
                            "tabular-nums font-semibold",
                            delta < 0
                              ? "text-rose-200"
                              : delta > 0
                                ? "text-emerald-200"
                                : "text-white/75"
                          )}
                          title="licenses - demand"
                        >
                          {formatInt(delta)}
                        </Td>

                        <Td>
                          {expSoon ? (
                            <span className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border border-amber-300/20 bg-amber-500/10 text-amber-100">
                              <TimerReset className="h-4 w-4" />
                              Да
                            </span>
                          ) : (
                            <span className="text-white/55">—</span>
                          )}
                        </Td>

                        <Td className="text-white/70">
                          {str(r.nearest_end_date) || "—"}
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