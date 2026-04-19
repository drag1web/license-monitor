import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Filter,
  Search,
  Sparkles,
  TriangleAlert,
  CircleCheck,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { cn } from "../ui/cn/cn";
import { Card } from "../ui/Card";
import { useAuth } from "../auth/AuthContext";
import { ViewerNotice } from "../components/ViewerNotice";
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

import { getRuns, getRunResults, type RunRow } from "../api";
import { computeRunDiff, diffScore, type DiffItem } from "../ui/diff/runDiff";
import { toCsv, downloadTextFile } from "../ui/diff/csv";
import { useToast } from "../ui/toast";

type Tone = "ok" | "warn" | "bad" | "none";

type KindFilter = "all" | "new" | "removed" | "changed";
type ScoreSort = "score" | "delta" | "demand" | "licenses";

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toneFromItem(x: DiffItem): Tone {
  // хуже = delta вырос
  if (x.kind === "new") return "warn";
  if (x.kind === "removed") return "ok";
  if (x.delta_now > x.delta_prev) return "bad";
  if (x.expires_now && !x.expires_prev) return "warn";
  return "ok";
}

function badge(t: Tone) {
  if (t === "bad") return "border-rose-300/20 bg-rose-500/10 text-rose-100";
  if (t === "warn") return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  if (t === "ok") return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  return "border-white/10 bg-white/[0.03] text-white/70";
}

function iconForTone(t: Tone) {
  if (t === "ok") return <CircleCheck className="h-4 w-4" />;
  if (t === "warn") return <TriangleAlert className="h-4 w-4" />;
  if (t === "bad") return <TriangleAlert className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

function Pill({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border", badge(tone))}>
      {iconForTone(tone)}
      {children}
    </span>
  );
}

function KindPill({ kind }: { kind: DiffItem["kind"] }) {
  const p =
    kind === "new"
      ? { t: "НОВОЕ", cls: "border-cyan-300/20 bg-cyan-500/10 text-cyan-100" }
      : kind === "removed"
        ? { t: "УДАЛЕНО", cls: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" }
        : kind === "changed"
          ? { t: "ИЗМЕНЕНО", cls: "border-amber-300/20 bg-amber-500/10 text-amber-100" }
          : { t: "—", cls: "border-white/10 bg-white/[0.03] text-white/70" };

  return (
    <span className={cn("inline-flex items-center rounded-2xl px-3 py-1.5 text-[12px] font-semibold border", p.cls)}>
      {p.t}
    </span>
  );
}

function SoftButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold " +
    "transition outline-none active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed " +
    "focus-visible:ring-2 focus-visible:ring-cyan-300/25";
  return (
    <button
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(
        base,
        "bg-white/[0.03] border border-white/[0.08] text-white/85 hover:bg-white/[0.06]",
        "shadow-[0_14px_55px_rgba(0,0,0,0.35)]",
        props.className
      )}
    >
      {props.leftIcon}
      {props.children}
    </button>
  );
}

export default function RunDiff() {
  const toast = useToast();
  const { id } = useParams();
  const runId = useMemo(() => Number(id), [id]);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [now, setNow] = useState<RunRow | null>(null);
  const [prev, setPrev] = useState<RunRow | null>(null);

  const [diff, setDiff] = useState<ReturnType<typeof computeRunDiff> | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [onlyWorsened, setOnlyWorsened] = useState(false);
  const [onlyImproved, setOnlyImproved] = useState(false);
  const [expiresBecameYes, setExpiresBecameYes] = useState(false);

  const [sort, setSort] = useState<ScoreSort>("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function load() {
    if (!Number.isFinite(runId) || runId <= 0) {
      setErr("Некорректный id запуска.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const all = await getRuns(); // last 50
      if (!mounted.current) return;
      setRuns(all);

      const idx = all.findIndex((r) => r.id === runId);
      const nowRun = idx >= 0 ? all[idx] : null;
      const prevRun = idx >= 0 ? all[idx + 1] ?? null : null;

      setNow(nowRun);
      setPrev(prevRun);

      if (!nowRun) {
        setDiff(null);
        setErr("Запуск не найден в последних 50 (или список пуст).");
        setLoading(false);
        return;
      }

      if (!prevRun) {
        setDiff(null);
        setLoading(false);
        return;
      }

      const [nowRows, prevRows] = await Promise.all([
        getRunResults(nowRun.id),
        getRunResults(prevRun.id),
      ]);

      if (!mounted.current) return;

      setDiff(computeRunDiff(nowRows, prevRows));
    } catch (e: any) {
      if (!mounted.current) return;
      setErr(String(e?.message ?? e));
      setDiff(null);
    } finally {
      if (!mounted.current) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const headerTone: Tone = useMemo(() => {
    if (!diff) return "none";
    if (diff.counts.worsened > 0) return "bad";
    if (diff.counts.expiresNew > 0 || diff.counts.newRows > 0) return "warn";
    return "ok";
  }, [diff]);

  const filtered = useMemo(() => {
    if (!diff) return [];

    const needle = q.trim().toLowerCase();

    return diff.items
      .filter((x) => x.kind !== "same")
      .filter((x) => {
        if (kind === "all") return true;
        return x.kind === kind;
      })
      .filter((x) => {
        if (!needle) return true;
        const hay = `${x.product} ${x.license_type} ${x.risk_now} ${x.risk_prev}`.toLowerCase();
        return hay.includes(needle);
      })
      .filter((x) => {
        if (onlyWorsened && !(x.delta_now > x.delta_prev)) return false;
        if (onlyImproved && !(x.delta_now < x.delta_prev)) return false;
        if (expiresBecameYes && !(x.expires_now && !x.expires_prev)) return false;
        return true;
      });
  }, [diff, q, kind, onlyWorsened, onlyImproved, expiresBecameYes]);

  const sorted = useMemo(() => {
    const mul = sortDir === "asc" ? 1 : -1;

    const keyFn = (x: DiffItem) => {
      if (sort === "score") return diffScore(x);
      if (sort === "delta") return Math.abs(x.delta_now - x.delta_prev);
      if (sort === "demand") return Math.abs(x.demand_now - x.demand_prev);
      return Math.abs(x.licenses_now - x.licenses_prev);
    };

    return [...filtered].sort((a, b) => (keyFn(a) - keyFn(b)) * mul);
  }, [filtered, sort, sortDir]);

  function exportCsv() {
    if (!diff || !now || !prev) return;

    const rows = sorted.map((x) => ({
      kind: x.kind,
      product: x.product,
      license_type: x.license_type,
      risk_prev: x.risk_prev,
      risk_now: x.risk_now,
      demand_prev: x.demand_prev,
      demand_now: x.demand_now,
      licenses_prev: x.licenses_prev,
      licenses_now: x.licenses_now,
      delta_prev: x.delta_prev,
      delta_now: x.delta_now,
      expires_prev: x.expires_prev,
      expires_now: x.expires_now,
    }));

    const headers = Object.keys(rows[0] ?? {
      kind: "",
      product: "",
      license_type: "",
      risk_prev: "",
      risk_now: "",
      demand_prev: "",
      demand_now: "",
      licenses_prev: "",
      licenses_now: "",
      delta_prev: "",
      delta_now: "",
      expires_prev: "",
      expires_now: "",
    });

    const csv = toCsv(rows, headers);
    downloadTextFile(
      `diff_run_${now.id}_vs_${prev.id}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );

    toast.push({
      tone: "success",
      title: "Экспорт готов",
      message: `Скачал diff_run_${now.id}_vs_${prev.id}.csv (${rows.length} строк)`,
    });
  }

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <ViewerNotice message="У вас нет прав на изменение данных. Доступен только просмотр сравнений запусков." />
      )}
      {/* Header / Hero */}
      <Card
        className={cn(
          "relative overflow-hidden rounded-3xl p-5",
          "border border-white/[0.08]",
          "bg-gradient-to-b from-slate-950/70 via-slate-950/45 to-slate-950/25",
          "backdrop-blur-xl",
          "shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Link
                to={`/runs/${runId}`}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
                  "bg-white/[0.03] border border-white/[0.08]",
                  "hover:bg-white/[0.06] hover:border-white/[0.12]",
                  "transition shadow-[0_14px_55px_rgba(0,0,0,0.35)]",
                  "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                )}
                title="Назад к деталям запуска"
              >
                <ArrowLeft className="h-4 w-4" />
                Назад
              </Link>

              <div className="min-w-0">
                <div className="text-xs text-white/50">Сравнение запусков</div>
                <div className="mt-1 text-2xl font-semibold text-white/90 tracking-tight">
                  Запуск #{runId} — сравнение с предыдущим
                </div>

                <div className="mt-1 text-sm text-white/55 max-w-[80ch]">
                  Здесь видно, <span className="text-white/80 font-semibold">что именно изменилось</span> между двумя запусками:
                  новые проблемы, улучшения, ухудшения и изменения по срокам истечения.
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Pill tone={headerTone}>
                    {headerTone === "bad"
                      ? "Есть ухудшения"
                      : headerTone === "warn"
                        ? "Есть новые риски"
                        : headerTone === "ok"
                          ? "Стабильно / улучшения"
                          : "Нет данных"}
                  </Pill>

                  {now && (
                    <span className="inline-flex items-center gap-2 text-[12px] text-white/45">
                      <Clock className="h-4 w-4" />
                      текущий: #{now.id} • {String(now.run_at)}
                    </span>
                  )}

                  {prev && (
                    <span className="inline-flex items-center gap-2 text-[12px] text-white/45">
                      <Clock className="h-4 w-4" />
                      предыдущий: #{prev.id} • {String(prev.run_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <SoftButton
                onClick={() => load()}
                disabled={loading}
                leftIcon={
                  <Sparkles className={cn("h-4 w-4", loading && "animate-pulse")} />
                }
                title="Пересчитать diff"
              >
                Пересчитать
              </SoftButton>

              <SoftButton
                onClick={exportCsv}
                disabled={!diff || !prev}
                leftIcon={<Download className="h-4 w-4" />}
                title="Экспортировать текущий diff в CSV"
              >
                Экспорт CSV
              </SoftButton>

              {prev && (
                <Link
                  to={`/runs/${prev.id}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
                    "bg-white/[0.03] border border-white/[0.08]",
                    "hover:bg-white/[0.06] hover:border-white/[0.12]",
                    "transition shadow-[0_14px_55px_rgba(0,0,0,0.35)]",
                    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                  )}
                  title="Открыть предыдущий запуск"
                >
                  Предыдущий запуск #{prev.id}
                  <ArrowUpRight className="h-4 w-4 text-white/55" />
                </Link>
              )}
            </div>
          </div>

          {/* Filters */}
          <div
            className={cn(
              "rounded-3xl border border-white/[0.08] bg-white/[0.02]",
              "p-4"
            )}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-white/70">
                <Filter className="h-4 w-4" />
                <div className="text-sm font-semibold">Фильтры</div>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_220px_280px_120px]">
                {/* Search */}
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-3.5 py-2",
                    "bg-white/[0.03] border-white/[0.08]",
                    "focus-within:border-cyan-200/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.10)]"
                  )}
                >
                  <Search className="h-4 w-4 shrink-0 text-white/45" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Поиск: продукт / тип лицензии / риск…"
                    className="w-full min-w-0 bg-transparent outline-none text-sm text-white/85 placeholder:text-white/35"
                  />
                </div>

                {/* Kind */}
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as KindFilter)}
                  className={cn(
                    "rounded-2xl border px-3.5 py-2 text-sm",
                    "bg-white/[0.03] border-white/[0.08] text-white/85",
                    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                  )}
                >
                  <option value="all">Все типы</option>
                  <option value="new">Новые</option>
                  <option value="changed">Изменённые</option>
                  <option value="removed">Удалённые</option>
                </select>

                {/* Sort */}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ScoreSort)}
                  className={cn(
                    "rounded-2xl border px-3.5 py-2 text-sm",
                    "bg-white/[0.03] border-white/[0.08] text-white/85",
                    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                  )}
                >
                  <option value="score">Сортировка: важность</option>
                  <option value="delta">Сортировка: Δ дельта</option>
                  <option value="demand">Сортировка: Δ потребность</option>
                  <option value="licenses">Сортировка: Δ лицензии</option>
                </select>

                {/* Sort direction */}
                <button
                  className={cn(
                    "rounded-2xl border px-3.5 py-2",
                    "bg-white/[0.03] border-white/[0.08] text-white/85 hover:bg-white/[0.06]",
                    "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                  )}
                  onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  title="Сменить направление сортировки"
                  type="button"
                >
                  {sortDir === "desc" ? (
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      убыв. <ChevronDown className="h-4 w-4" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      возр. <ChevronUp className="h-4 w-4" />
                    </span>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Toggle
                  on={onlyWorsened}
                  setOn={(v) => {
                    setOnlyWorsened(v);
                    if (v) setOnlyImproved(false);
                  }}
                  label="Только ухудшения"
                  tone="bad"
                />
                <Toggle
                  on={onlyImproved}
                  setOn={(v) => {
                    setOnlyImproved(v);
                    if (v) setOnlyWorsened(false);
                  }}
                  label="Только улучшения"
                  tone="ok"
                />
                <Toggle
                  on={expiresBecameYes}
                  setOn={setExpiresBecameYes}
                  label="Стало истекающим"
                  tone="warn"
                />
              </div>
            </div>

            {diff && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-2">
                <MiniStat label="Новые" value={diff.counts.newRows} tone={diff.counts.newRows ? "warn" : "ok"} />
                <MiniStat label="Удалённые" value={diff.counts.removedRows} tone="ok" />
                <MiniStat label="Ухудшения" value={diff.counts.worsened} tone={diff.counts.worsened ? "bad" : "ok"} />
                <MiniStat label="Улучшения" value={diff.counts.improved} tone="ok" />
                <MiniStat label="Новые истечения" value={diff.counts.expiresNew} tone={diff.counts.expiresNew ? "warn" : "ok"} />
                <MiniStat label="Показано" value={sorted.length} tone="none" />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Main table */}
      <Card className="p-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
        <Table>
          <TableCaption
            title="Элементы сравнения"
            description="Строки, которые появились / исчезли / изменились. Отсортировано и отфильтровано."
            right={
              <div className="text-[11px] text-white/45">
                {loading ? "Загружаю…" : diff ? `Items: ${sorted.length}` : "—"}
              </div>
            }
          />

          {loading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : err ? (
            <TableEmpty title="Ошибка" description={err} />
          ) : !now ? (
            <TableEmpty title="Нет запуска" description="Не удалось найти запуск в списке." />
          ) : !prev ? (
            <TableEmpty
              title="Нет предыдущего запуска"
              description="Чтобы построить diff, нужно минимум два запуска. Запусти проверку ещё раз."
              action={
                <Link
                  to="/"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
                    "bg-white/[0.03] border border-white/[0.08]",
                    "hover:bg-white/[0.06] hover:border-white/[0.12]",
                    "transition shadow-[0_14px_55px_rgba(0,0,0,0.35)]"
                  )}
                >
                  На главную <ArrowUpRight className="h-4 w-4" />
                </Link>
              }
            />
          ) : !diff ? (
            <TableEmpty title="Нет сравнения" description="Не удалось построить сравнение." />
          ) : sorted.length === 0 ? (
            <TableEmpty
              title="Пусто"
              description="По текущим фильтрам ничего не найдено. Попробуй сбросить фильтры."
              action={
                <SoftButton
                  onClick={() => {
                    setQ("");
                    setKind("all");
                    setOnlyWorsened(false);
                    setOnlyImproved(false);
                    setExpiresBecameYes(false);
                    toast.push({ tone: "info", title: "Фильтры", message: "Фильтры сброшены." });
                  }}
                  leftIcon={<Filter className="h-4 w-4" />}
                >
                  Reset
                </SoftButton>
              }
            />
          ) : (
            <TableScroll className="max-h-[70vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    <SortTh label="тип" dir={null} />
                    <SortTh label="продукт" dir={null} />
                    <SortTh label="тип лицензии" dir={null} />
                    <SortTh label="риск" dir={null} />
                    <SortTh label="дельта" dir={null} />
                    <SortTh label="истечение" dir={null} />
                    <SortTh label="потребность / лицензии" dir={null} />
                  </tr>
                </THead>

                <TBody>
                  {sorted.slice(0, 200).map((x) => {
                    const t = toneFromItem(x);

                    return (
                      <Tr key={x.key}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <KindPill kind={x.kind} />
                            <span className={cn("text-[12px] font-semibold border rounded-2xl px-2.5 py-1", badge(t))}>
                              {t.toUpperCase()}
                            </span>
                          </div>
                        </Td>

                        <Td className="font-semibold text-white/85">{x.product}</Td>
                        <Td className="text-white/70">{x.license_type}</Td>

                        <Td className="text-white/70">
                          <span className="text-white/50">{x.risk_prev || "—"}</span>
                          <span className="mx-2 text-white/30">→</span>
                          <span className="text-white/85 font-semibold">{x.risk_now || "—"}</span>
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums font-semibold",
                            x.delta_now > x.delta_prev
                              ? "text-rose-200"
                              : x.delta_now < x.delta_prev
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
                            <span className="text-amber-200 font-semibold">стало: да</span>
                          ) : (
                            <span className="text-emerald-200 font-semibold">стало: нет</span>
                          )}
                        </Td>

                        <Td className="tabular-nums text-white/75">
                          {x.demand_prev}/{x.licenses_prev} → {x.demand_now}/{x.licenses_now}
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

      <div className="text-[12px] text-white/45">
        Показано максимум 200 строк (чтобы UI летал). Экспорт учитывает текущие фильтры.
      </div>
    </div>
  );
}

/* ------------------------------------------
 *  Toggle + MiniStat
 * ------------------------------------------ */

function Toggle({
  on,
  setOn,
  label,
  tone,
}: {
  on: boolean;
  setOn: (v: boolean) => void;
  label: string;
  tone: Tone;
}) {
  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border",
        on
          ? tone === "bad"
            ? "border-rose-300/25 bg-rose-500/12 text-rose-100"
            : tone === "warn"
              ? "border-amber-300/25 bg-amber-500/12 text-amber-100"
              : tone === "ok"
                ? "border-emerald-300/25 bg-emerald-500/12 text-emerald-100"
                : "border-cyan-300/25 bg-cyan-500/12 text-cyan-100"
          : "border-white/[0.08] bg-white/[0.03] text-white/75 hover:bg-white/[0.06]",
        "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", on ? "bg-white" : "bg-white/30")} />
      {label}
    </button>
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
