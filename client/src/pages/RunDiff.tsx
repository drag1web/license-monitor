import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Filter,
  Search,
  TriangleAlert,
  CircleCheck,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  GitCompare,
  X,
} from "lucide-react";

import { cn } from "../ui/cn/cn";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
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

function toneFromItem(x: DiffItem): Tone {
  if (x.kind === "new") return "warn";
  if (x.kind === "removed") return "ok";
  if (x.delta_now > x.delta_prev) return "bad";
  if (x.expires_now && !x.expires_prev) return "warn";
  return "ok";
}

function toneClass(t: Tone) {
  if (t === "bad") return "border-red-200 bg-red-50 text-red-700";
  if (t === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  if (t === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function KindPill({ kind }: { kind: DiffItem["kind"] }) {
  const map =
    kind === "new"
      ? { text: "Новая", cls: "border-blue-200 bg-blue-50 text-blue-700" }
      : kind === "removed"
        ? { text: "Удалена", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
        : kind === "changed"
          ? { text: "Изменена", cls: "border-amber-200 bg-amber-50 text-amber-700" }
          : { text: "—", cls: "border-slate-200 bg-slate-50 text-slate-600" };

  return (
    <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-medium", map.cls)}>
      {map.text}
    </span>
  );
}

function RiskPill({ tone }: { tone: Tone }) {
  const text =
    tone === "bad" ? "Ухудшение" : tone === "warn" ? "Внимание" : tone === "ok" ? "Норма" : "—";

  const Icon = tone === "ok" ? CircleCheck : tone === "none" ? Clock : TriangleAlert;

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium", toneClass(tone))}>
      <Icon className="h-4 w-4" />
      {text}
    </span>
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
  return (
    <div className={cn("rounded-xl border bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]", toneClass(tone))}>
      <div className="text-sm opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
  tone = "none",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
        active ? toneClass(tone).replace("bg-", "bg-").replace("border-", "border-") : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        active && tone === "none" && "border-slate-900 bg-slate-900 text-white"
      )}
    >
      {label}
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

  const [now, setNow] = useState<RunRow | null>(null);
  const [prev, setPrev] = useState<RunRow | null>(null);
  const [diff, setDiff] = useState<ReturnType<typeof computeRunDiff> | null>(null);

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
      const all = await getRuns();

      if (!mounted.current) return;

      const allSorted = [...all].sort((a, b) => Number(b.id) - Number(a.id));

      const idx = allSorted.findIndex((r) => r.id === runId);
      const nowRun = idx >= 0 ? allSorted[idx] : null;
      const prevRun = idx >= 0 ? allSorted[idx + 1] ?? null : null;

      setNow(nowRun);
      setPrev(prevRun);

      if (!nowRun) {
        setDiff(null);
        setErr("Запуск не найден в последних 50 запусках.");
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
      .filter((x) => (kind === "all" ? true : x.kind === kind))
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

  function resetFilters() {
    setQ("");
    setKind("all");
    setOnlyWorsened(false);
    setOnlyImproved(false);
    setExpiresBecameYes(false);

    toast.push({
      tone: "info",
      title: "Фильтры",
      message: "Фильтры сравнения сброшены.",
    });
  }

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

    const headers = Object.keys(
      rows[0] ?? {
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
      }
    );

    const csv = toCsv(rows, headers);

    downloadTextFile(
      `diff_run_${now.id}_vs_${prev.id}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );

    toast.push({
      tone: "success",
      title: "Экспорт готов",
      message: `Файл diff_run_${now.id}_vs_${prev.id}.csv сформирован.`,
    });
  }

  const headerTitle =
    headerTone === "bad"
      ? "Есть ухудшения"
      : headerTone === "warn"
        ? "Есть новые риски"
        : headerTone === "ok"
          ? "Состояние стабильно"
          : "Нет данных";

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <ViewerNotice message="У вас нет прав на изменение данных. Доступен только просмотр сравнений запусков." />
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl border", toneClass(headerTone))}>
              <GitCompare className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="text-sm text-slate-500">Сравнение запусков</div>

              <div className="mt-1 text-2xl font-semibold text-slate-950">
                {headerTitle}
              </div>

              <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Анализ изменений между текущим и предыдущим запуском проверки:
                новые строки, удалённые позиции, ухудшения, улучшения и изменения по срокам.
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {now && (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Clock className="h-4 w-4" />
                    Текущий: #{now.id} · {String(now.run_at)}
                  </span>
                )}

                {prev && (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Clock className="h-4 w-4" />
                    Предыдущий: #{prev.id} · {String(prev.run_at)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <Link to={`/runs/${runId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
                К деталям
              </Button>
            </Link>

            <Button variant="ghost" size="sm" onClick={() => load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Пересчитать
            </Button>

            <Button size="sm" onClick={exportCsv} disabled={!diff || !prev}>
              <Download className="h-4 w-4" />
              Экспорт CSV
            </Button>

            {prev && (
              <Link to={`/runs/${prev.id}`}>
                <Button variant="ghost" size="sm">
                  Предыдущий #{prev.id}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Card>

      {diff && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MiniStat label="Новые" value={diff.counts.newRows} tone={diff.counts.newRows ? "warn" : "ok"} />
          <MiniStat label="Удалённые" value={diff.counts.removedRows} tone="ok" />
          <MiniStat label="Ухудшения" value={diff.counts.worsened} tone={diff.counts.worsened ? "bad" : "ok"} />
          <MiniStat label="Улучшения" value={diff.counts.improved} tone="ok" />
          <MiniStat label="Новые истечения" value={diff.counts.expiresNew} tone={diff.counts.expiresNew ? "warn" : "ok"} />
          <MiniStat label="Показано" value={sorted.length} />
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter className="h-4 w-4" />
            <div className="text-sm font-semibold">Фильтры сравнения</div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_220px_260px_130px]">
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-slate-100">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />

              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск: продукт, тип лицензии, риск..."
                className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />

              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as KindFilter)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
            >
              <option value="all">Все типы</option>
              <option value="new">Новые</option>
              <option value="changed">Изменённые</option>
              <option value="removed">Удалённые</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ScoreSort)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
            >
              <option value="score">Сортировка: важность</option>
              <option value="delta">Сортировка: Δ дельта</option>
              <option value="demand">Сортировка: Δ потребность</option>
              <option value="licenses">Сортировка: Δ лицензии</option>
            </select>

            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              type="button"
            >
              {sortDir === "desc" ? (
                <>
                  Убыв.
                  <ChevronDown className="h-4 w-4" />
                </>
              ) : (
                <>
                  Возр.
                  <ChevronUp className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Toggle
              active={onlyWorsened}
              tone="bad"
              label="Только ухудшения"
              onClick={() => {
                setOnlyWorsened((v) => !v);
                setOnlyImproved(false);
              }}
            />

            <Toggle
              active={onlyImproved}
              tone="ok"
              label="Только улучшения"
              onClick={() => {
                setOnlyImproved((v) => !v);
                setOnlyWorsened(false);
              }}
            />

            <Toggle
              active={expiresBecameYes}
              tone="warn"
              label="Стало истекающим"
              onClick={() => setExpiresBecameYes((v) => !v)}
            />

            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Сбросить
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableCaption
            title="Элементы сравнения"
            description="Строки, которые появились, исчезли или изменились между двумя запусками."
            right={
              <div className="text-xs text-slate-500">
                {loading ? "Загрузка..." : diff ? `Показано: ${sorted.length}` : "—"}
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
              description="Для построения сравнения нужно минимум два запуска проверки."
              action={
                <Link to="/">
                  <Button>
                    На главную
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </Link>
              }
            />
          ) : !diff ? (
            <TableEmpty title="Нет сравнения" description="Не удалось построить сравнение." />
          ) : sorted.length === 0 ? (
            <TableEmpty
              title="Ничего не найдено"
              description="По текущим фильтрам нет строк сравнения."
              action={
                <Button variant="ghost" onClick={resetFilters}>
                  Сбросить фильтры
                </Button>
              }
            />
          ) : (
            <TableScroll className="max-h-[70vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    <SortTh label="Тип" dir={null} />
                    <SortTh label="Продукт" dir={null} />
                    <SortTh label="Тип лицензии" dir={null} />
                    <SortTh label="Риск" dir={null} />
                    <SortTh label="Дельта" dir={null} />
                    <SortTh label="Истечение" dir={null} />
                    <SortTh label="Потребность / лицензии" dir={null} />
                  </tr>
                </THead>

                <TBody>
                  {sorted.slice(0, 200).map((x) => {
                    const t = toneFromItem(x);

                    return (
                      <Tr key={x.key}>
                        <Td>
                          <div className="flex flex-wrap items-center gap-2">
                            <KindPill kind={x.kind} />
                            <RiskPill tone={t} />
                          </div>
                        </Td>

                        <Td className="font-semibold text-slate-900">
                          {x.product}
                        </Td>

                        <Td className="text-slate-700">{x.license_type}</Td>

                        <Td className="text-slate-700">
                          <span className="text-slate-500">{x.risk_prev || "—"}</span>
                          <span className="mx-2 text-slate-400">→</span>
                          <span className="font-semibold text-slate-900">
                            {x.risk_now || "—"}
                          </span>
                        </Td>

                        <Td
                          className={cn(
                            "tabular-nums font-semibold",
                            x.delta_now > x.delta_prev
                              ? "text-red-700"
                              : x.delta_now < x.delta_prev
                                ? "text-emerald-700"
                                : "text-slate-700"
                          )}
                        >
                          {x.delta_prev} → {x.delta_now}
                        </Td>

                        <Td className="text-slate-700">
                          {x.expires_prev === x.expires_now ? (
                            <span className="text-slate-400">—</span>
                          ) : x.expires_now ? (
                            <span className="font-semibold text-amber-700">
                              стало: да
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-700">
                              стало: нет
                            </span>
                          )}
                        </Td>

                        <Td className="tabular-nums text-slate-700">
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

      <div className="text-xs text-slate-500">
        Показано максимум 200 строк для сохранения плавности интерфейса. Экспорт CSV учитывает текущие фильтры.
      </div>
    </div>
  );
}