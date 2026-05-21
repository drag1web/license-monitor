import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getRunResults,
  getRunUnmatched,
  getProducts,
  createMappingRule,
  runCheck,
  type ResultRow,
  type UnmatchedRow,
  type ProductRow,
} from "../api";

import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAuth } from "../auth/AuthContext";
import { ViewerNotice } from "../components/ViewerNotice";
import { useToast } from "../ui/toast";
import { Dropdown } from "../components/Dropdown";
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
  Layers,
  ShieldAlert,
  TimerReset,
  Plus,
  Boxes,
  Database,
  FileInput,
  GitBranch,
  Play,
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

type MappingPreviewMatch = {
  id: number;
  software_name: string;
  software_version?: string | null;
  device?: string | null;
  user?: string | null;
};

function nextDir(d: SortDir): SortDir {
  if (d === null) return "asc";
  if (d === "asc") return "desc";
  return null;
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
  if (s === "no" || s === "n" || s === "false" || s === "—" || s === "") {
    return false;
  }

  return safeNum(v) > 0;
}

function derivedRisk(row: ResultRow): DerivedRisk {
  const delta = safeNum(row.delta);
  const expSoon = isExpSoon(row.expires_soon);

  if (delta > 0) return "high";
  if (expSoon) return "medium";

  return "low";
}

function doesPatternMatch(input: string, pattern: string, matchType: string) {
  const source = str(input).trim();
  const rule = str(pattern).trim();

  if (!source || !rule) return false;

  if (matchType === "exact") {
    return source.toLowerCase() === rule.toLowerCase();
  }

  if (matchType === "regex") {
    try {
      return new RegExp(rule, "i").test(source);
    } catch {
      return false;
    }
  }

  return source.toLowerCase().includes(rule.toLowerCase());
}

function buildPreviewMatches(
  rows: UnmatchedRow[],
  pattern: string,
  matchType: string
): MappingPreviewMatch[] {
  const normalizedPattern = pattern.trim();
  if (!normalizedPattern) return [];

  return rows
    .filter((row) =>
      doesPatternMatch(row.software_name ?? "", normalizedPattern, matchType)
    )
    .map((row) => ({
      id: row.id,
      software_name: row.software_name,
      software_version: row.software_version,
      device: row.device,
      user: row.user,
    }));
}

function riskOrder(r: DerivedRisk) {
  if (r === "high") return 3;
  if (r === "medium") return 2;
  return 1;
}

function riskPill(risk: DerivedRisk) {
  if (risk === "high") {
    return {
      label: "Высокий",
      cls: "border-red-200 bg-red-50 text-red-700",
      icon: <Flame className="h-4 w-4" />,
    };
  }

  if (risk === "medium") {
    return {
      label: "Средний",
      cls: "border-amber-200 bg-amber-50 text-amber-700",
      icon: <TriangleAlert className="h-4 w-4" />,
    };
  }

  return {
    label: "Норма",
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
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

      if (Number.isFinite(at) && Number.isFinite(bt)) {
        return (at - bt) * mul;
      }

      return str(a.nearest_end_date).localeCompare(str(b.nearest_end_date)) * mul;
    }

    return str(a[key]).localeCompare(str(b[key])) * mul;
  };
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
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
        tone === "bad"
          ? "border-red-200"
          : tone === "warn"
            ? "border-amber-200"
            : tone === "ok"
              ? "border-emerald-200"
              : "border-slate-200"
      )}
    >
      <div className="text-sm text-slate-500">{label}</div>

      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "bad"
            ? "text-red-700"
            : tone === "warn"
              ? "text-amber-700"
              : tone === "ok"
                ? "text-emerald-700"
                : "text-slate-950"
        )}
      >
        {value}
      </div>

      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function ModalInfoCard({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
        {icon}
        <span>{title}</span>
      </div>

      <div className="space-y-2 text-sm text-slate-600">{children}</div>
    </div>
  );
}

function getSelectedProductById(products: ProductRow[], rawId: string) {
  const id = Number(rawId);

  if (!Number.isFinite(id) || id <= 0) return null;

  return products.find((p) => p.id === id) ?? null;
}

function getProductSelectLabel(products: ProductRow[], rawId: string) {
  const selected = getSelectedProductById(products, rawId);

  if (!selected) return "Не выбран";

  return selected.vendor ? `${selected.name} — ${selected.vendor}` : selected.name;
}

function getMatchTypeSelectLabel(value: string) {
  if (value === "exact") return "Точное совпадение";
  if (value === "contains") return "Содержит";
  if (value === "regex") return "Регулярное выражение";
  return "Содержит";
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
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
        active
          ? tone === "bad"
            ? "border-red-600 bg-red-600 text-white"
            : tone === "warn"
              ? "border-amber-500 bg-amber-500 text-white"
              : tone === "ok"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      )}
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
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      )}
      type="button"
    >
      {label}
    </button>
  );
}

export default function RunDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const runId = useMemo(() => Number(id), [id]);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rerunBusy, setRerunBusy] = useState(false);

  const [q, setQ] = useState("");
  const [onlyRisk, setOnlyRisk] = useState<"all" | "high" | "medium" | "low">(
    "all"
  );
  const [onlyExpSoon, setOnlyExpSoon] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toast = useToast();

  const [unmatchedRows, setUnmatchedRows] = useState<UnmatchedRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedUnmatched, setSelectedUnmatched] = useState<UnmatchedRow | null>(
    null
  );

  const [mappingCreateOpen, setMappingCreateOpen] = useState(false);
  const [mappingCreateBusy, setMappingCreateBusy] = useState(false);
  const [mappingCreateError, setMappingCreateError] = useState("");

  const [newPattern, setNewPattern] = useState("");
  const [newCanonicalProduct, setNewCanonicalProduct] = useState("");
  const [newMatchType, setNewMatchType] = useState("contains");
  const [newProductId, setNewProductId] = useState("");

  const [createProductDropdownOpen, setCreateProductDropdownOpen] =
    useState(false);
  const [createMatchTypeOpen, setCreateMatchTypeOpen] = useState(false);

  const createProductAnchorRef = useRef<HTMLButtonElement | null>(null);
  const createMatchTypeAnchorRef = useRef<HTMLButtonElement | null>(null);

  const [lastCreatedRule, setLastCreatedRule] = useState<{
    pattern: string;
    matches: number;
  } | null>(null);

  async function refresh() {
    if (!Number.isFinite(runId) || runId <= 0) return;

    setErr("");
    setLoading(true);

    try {
      const [data, unmatchedData, productsData] = await Promise.all([
        getRunResults(runId),
        getRunUnmatched(runId),
        getProducts(),
      ]);

      setRows(data ?? []);
      setUnmatchedRows(unmatchedData ?? []);
      setProducts(productsData ?? []);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function runAgainAndOpen() {
    if (!isAdmin) {
      toast.push({
        tone: "error",
        title: "Недостаточно прав",
        message: "Только admin может запускать проверку.",
      });
      return;
    }

    setRerunBusy(true);
    setErr("");

    try {
      const out = await runCheck();

      if (!out.ok) {
        throw new Error(out.error || "Не удалось запустить проверку");
      }

      window.dispatchEvent(new CustomEvent("alerts:refresh"));

      if (out.runId) {
        toast.push({
          tone: "success",
          title: "Проверка завершена",
          message: `Открываю новый запуск #${out.runId}.`,
        });

        navigate(`/runs/${out.runId}`);
        return;
      }

      toast.push({
        tone: "success",
        title: "Проверка завершена",
        message: "Сервер не вернул ID запуска. Обновляю текущую страницу.",
      });

      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      toast.push({
        tone: "error",
        title: "Ошибка запуска",
        message: msg,
      });

      setErr(msg);
    } finally {
      setRerunBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  function openCreateRuleFromUnmatched(row: UnmatchedRow) {
    const base = row.software_name?.trim() || "";

    setSelectedUnmatched(row);
    setMappingCreateError("");
    setNewPattern(base);
    setNewCanonicalProduct(base);
    setNewMatchType("contains");
    setNewProductId("");
    setCreateProductDropdownOpen(false);
    setCreateMatchTypeOpen(false);
    setMappingCreateOpen(true);
  }

  function closeCreateRuleModal() {
    if (mappingCreateBusy) return;

    setMappingCreateOpen(false);
    setSelectedUnmatched(null);
    setCreateProductDropdownOpen(false);
    setCreateMatchTypeOpen(false);
    setMappingCreateError("");
  }

  function handleCreateProductSelect(productId: string) {
    setNewProductId(productId);
    setCreateProductDropdownOpen(false);

    const selected = getSelectedProductById(products, productId);

    if (selected) {
      setNewCanonicalProduct(selected.name);
    }
  }

  const previewMatches = useMemo(() => {
    return buildPreviewMatches(unmatchedRows, newPattern, newMatchType);
  }, [unmatchedRows, newPattern, newMatchType]);

  async function handleCreateRule() {
    const pattern = newPattern.trim();
    const canonicalProduct = newCanonicalProduct.trim();
    const productId = newProductId.trim();
    const matches = previewMatches.length;

    if (!isAdmin) {
      setMappingCreateError("Только admin может создавать правила сопоставления.");
      return;
    }

    if (!pattern) {
      setMappingCreateError("Укажите pattern.");
      return;
    }

    if (!canonicalProduct) {
      setMappingCreateError("Укажите каноническое название продукта.");
      return;
    }

    if (productId && (!Number.isFinite(Number(productId)) || Number(productId) <= 0)) {
      setMappingCreateError("Product ID должен быть положительным числом.");
      return;
    }

    setMappingCreateBusy(true);
    setMappingCreateError("");

    try {
      await createMappingRule({
        pattern,
        canonical_product: canonicalProduct,
        match_type: newMatchType,
        product_id: productId ? Number(productId) : undefined,
      });

      setLastCreatedRule({
        pattern,
        matches,
      });

      setMappingCreateOpen(false);
      setSelectedUnmatched(null);
      setCreateProductDropdownOpen(false);
      setCreateMatchTypeOpen(false);
      setMappingCreateError("");

      toast.push({
        tone: "success",
        title: "Правило создано",
        message: `Добавлено правило "${pattern}". Запускаю повторную проверку…`,
      });

      const runOut = await runCheck();

      if (!runOut.ok) {
        throw new Error(runOut.error || "Правило создано, но повторный запуск не выполнен");
      }

      window.dispatchEvent(new CustomEvent("alerts:refresh"));

      if (runOut.runId) {
        navigate(`/runs/${runOut.runId}`);
        return;
      }

      await refresh();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Не удалось создать правило сопоставления или запустить проверку";

      setMappingCreateError(msg);

      toast.push({
        tone: "error",
        title: "Ошибка",
        message: msg,
      });
    } finally {
      setMappingCreateBusy(false);
    }
  }

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
      const rr = derivedRisk(r);

      if (rr === "high") high++;
      else if (rr === "medium") med++;
      else low++;

      if (safeNum(r.delta) > 0) deficit++;
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

  const selectedPreviewHit = useMemo(() => {
    if (!selectedUnmatched) return false;
    return previewMatches.some((item) => item.id === selectedUnmatched.id);
  }, [previewMatches, selectedUnmatched]);

  const previewMatchIds = useMemo(() => {
    return new Set(previewMatches.map((item) => item.id));
  }, [previewMatches]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return rows.filter((r) => {
      const rr = derivedRisk(r);

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
          ? "Проблем не обнаружено"
          : "Нет данных";

  const heroSubtitle =
    headlineTone === "bad"
      ? "В этом запуске обнаружены дефициты или другие критичные позиции. Проверьте строки с высоким риском."
      : headlineTone === "warn"
        ? "Есть позиции, требующие внимания: истекающие лицензии или средний риск."
        : headlineTone === "ok"
          ? "Критичных проблем не найдено."
          : "Для этого запуска пока нет результатов.";

  if (!Number.isFinite(runId) || runId <= 0) {
    return (
      <Card className="p-5">
        <div className="text-sm font-semibold text-red-700">Некорректный ID</div>
        <div className="mt-1 text-xs text-slate-500">
          Проверьте URL. Ожидается число больше 0.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <ViewerNotice message="У вас нет прав на изменение данных. Доступен только просмотр результатов запуска." />
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div
              className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-xl border",
                headlineTone === "bad"
                  ? "border-red-200 bg-red-50 text-red-600"
                  : headlineTone === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-600"
                    : headlineTone === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : "border-slate-200 bg-slate-50 text-slate-600"
              )}
            >
              {headlineTone === "bad" ? (
                <Flame className="h-6 w-6" />
              ) : headlineTone === "warn" ? (
                <TriangleAlert className="h-6 w-6" />
              ) : headlineTone === "ok" ? (
                <CircleCheck className="h-6 w-6" />
              ) : (
                <Shield className="h-6 w-6" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-sm text-slate-500">Запуск #{runId}</div>

              <div className="mt-1 text-2xl font-semibold text-slate-950">
                {heroTitle}
              </div>

              <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                {heroSubtitle}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  to="/runs"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Назад к истории
                </Link>

                <Link
                  to="/imports"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <FileInput className="h-4 w-4" />
                  Импорты
                </Link>

                <Link
                  to="/dictionaries/mapping"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <GitBranch className="h-4 w-4" />
                  Правила
                </Link>

                {rows.length > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <Layers className="h-4 w-4" />
                    Строк: {formatInt(rows.length)}
                  </span>
                )}

                {stats.deficit > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    <ShieldAlert className="h-4 w-4" />
                    Дефицитов: {formatInt(stats.deficit)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => void runAgainAndOpen()}
                disabled={loading || rerunBusy}
                title="Запустить pipeline повторно и открыть новый результат"
              >
                <Play className={cn("h-4 w-4", rerunBusy && "animate-pulse")} />
                {rerunBusy ? "Запуск..." : "Повторить проверку"}
              </Button>
            )}

            <Link
              to={`/runs/${runId}/diff`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              title="Сравнить этот запуск с предыдущим"
            >
              <ArrowUpRight className="h-4 w-4" />
              Сравнение
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => refresh()}
              disabled={loading}
              title="Обновить"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Обновить
            </Button>

            <Button
              size="sm"
              onClick={() => {
                const el = document.getElementById("results-table");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              disabled={loading}
              title="К таблице"
            >
              <ArrowUpRight className="h-4 w-4" />
              К таблице
            </Button>
          </div>
        </div>
      </Card>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-sm font-semibold text-red-700">Ошибка</div>
          <div className="mt-1 break-words text-xs text-red-600">{err}</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Высокий риск"
          value={formatInt(stats.high)}
          hint="Дефицит лицензий"
          tone={stats.high > 0 ? "bad" : "ok"}
        />

        <StatCard
          label="Предупреждения"
          value={formatInt(stats.med)}
          hint="Истекающие лицензии"
          tone={stats.med > 0 ? "warn" : "ok"}
        />

        <StatCard
          label="Скоро истекают"
          value={formatInt(stats.expSoon)}
          hint="Контроль сроков"
          tone={stats.expSoon > 0 ? "warn" : "ok"}
        />

        <StatCard
          label="Суммарная дельта"
          value={formatInt(stats.sumDelta)}
          hint="Потребность − лицензии"
          tone={stats.sumDelta > 0 ? "bad" : stats.sumDelta < 0 ? "ok" : "none"}
        />

        <StatCard
          label="Несопоставленные"
          value={formatInt(unmatchedRows.length)}
          hint="Требуют правила"
          tone={unmatchedRows.length > 0 ? "warn" : "ok"}
        />
      </div>

      {mappingCreateOpen && newPattern.trim() && (
        <Card className="border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-blue-900">
                Предпросмотр покрытия несопоставленных строк
              </div>

              <div className="mt-1 text-xs text-blue-700">
                Pattern: <span className="font-mono">{newPattern}</span> · Тип:{" "}
                <span className="font-medium">
                  {getMatchTypeSelectLabel(newMatchType)}
                </span>{" "}
                · Потенциально покроется строк:{" "}
                <span className="font-semibold">{formatInt(previewMatches.length)}</span>
              </div>
            </div>

            {selectedUnmatched && (
              <div className="text-xs text-blue-700">
                Текущая строка:{" "}
                <span className="font-medium">{selectedUnmatched.software_name}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 xl:w-[520px]">
            <Search className="h-4 w-4 text-slate-400" />

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск: продукт, тип лицензии, дата, дельта..."
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />

            {q && (
              <button
                onClick={() => setQ("")}
                className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Очистить"
              >
                <X className="h-4 w-4" />
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
              label="Высокий риск"
              tone="bad"
              active={onlyRisk === "high"}
              onClick={() => setOnlyRisk("high")}
            />

            <FilterPill
              label="Предупреждения"
              tone="warn"
              active={onlyRisk === "medium"}
              onClick={() => setOnlyRisk("medium")}
            />

            <FilterPill
              label="Норма"
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

        <div className="mt-3 text-xs text-slate-500">
          Показано:{" "}
          <span className="font-semibold text-slate-800">
            {formatInt(sorted.length)}
          </span>{" "}
          из{" "}
          <span className="font-semibold text-slate-800">
            {formatInt(rows.length)}
          </span>
        </div>
      </Card>

      {lastCreatedRule && (
        <Card className="border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="text-sm font-semibold text-emerald-900">
                Правило создано
              </div>

              <div className="mt-1 text-xs text-emerald-700">
                Pattern:{" "}
                <span className="font-mono">{lastCreatedRule.pattern}</span> ·
                Покрывает строк: {formatInt(lastCreatedRule.matches)}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void runAgainAndOpen()}
                disabled={rerunBusy}
              >
                <Play className="h-4 w-4" />
                {rerunBusy ? "Запуск..." : "Запустить проверку"}
              </Button>

              <Link to="/dictionaries/mapping">
                <Button variant="ghost" size="sm">
                  Открыть правила
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLastCreatedRule(null)}
              >
                Закрыть
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableCaption
            title="Несопоставленные установки"
            description="Строки, для которых не найдено правило сопоставления."
            right={
              <div className="flex items-center gap-2">
                <Link
                  to="/dictionaries/mapping"
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <GitBranch className="h-4 w-4" />
                  Правила
                </Link>

                <div className="text-xs text-slate-500">
                  {loading ? "Обновление..." : `Строк: ${formatInt(unmatchedRows.length)}`}
                </div>
              </div>
            }
          />

          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : unmatchedRows.length === 0 ? (
            <TableEmpty
              title="Несопоставленных установок нет"
              description="Для этого запуска все установки были сопоставлены."
            />
          ) : (
            <TableScroll className="max-h-[42vh]">
              <TableInner stickyHeader density="comfortable" className="w-full table-auto">
                <THead>
                  <tr>
                    <SortTh label="ПО" dir={null} className="w-[28%]" />
                    <SortTh label="Версия" dir={null} className="w-[10%]" />
                    <SortTh label="Устройство" dir={null} className="w-[13%]" />
                    <SortTh label="Пользователь" dir={null} className="w-[14%]" />
                    <SortTh label="Причина" dir={null} className="w-[23%]" />
                    <SortTh label="Действия" dir={null} className="w-[12%]" />
                  </tr>
                </THead>

                <TBody>
                  {unmatchedRows.map((row) => {
                    const isSelected = selectedUnmatched?.id === row.id;
                    const isPreviewMatch = previewMatchIds.has(row.id);

                    return (
                      <Tr
                        key={row.id}
                        className={cn(
                          isSelected && "bg-blue-50",
                          !isSelected && isPreviewMatch && "bg-emerald-50"
                        )}
                      >
                        <Td className="font-semibold text-slate-900">
                          <div className="break-words leading-snug">
                            {row.software_name}
                          </div>
                        </Td>

                        <Td className="whitespace-nowrap text-slate-600">
                          {row.software_version || "—"}
                        </Td>

                        <Td className="whitespace-nowrap text-slate-600">
                          {row.device || "—"}
                        </Td>

                        <Td className="whitespace-nowrap text-slate-600">
                          {row.user || "—"}
                        </Td>

                        <Td className="text-slate-600">
                          <div className="flex flex-col gap-2">
                            <div className="whitespace-normal break-words leading-snug">
                              {row.reason || "—"}
                            </div>

                            {selectedUnmatched?.id === row.id ? (
                              <span className="inline-flex w-fit rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                                Текущая строка
                              </span>
                            ) : previewMatchIds.has(row.id) ? (
                              <span className="inline-flex w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                Покроется правилом
                              </span>
                            ) : null}
                          </div>
                        </Td>

                        <Td>
                          {isAdmin ? (
                            <Button
                              size="sm"
                              onClick={() => openCreateRuleFromUnmatched(row)}
                            >
                              <Plus className="h-4 w-4" />
                              Правило
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Только просмотр
                            </span>
                          )}
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

      <Card id="results-table" className="overflow-hidden">
        <Table>
          <TableCaption
            title={`Результаты запуска #${runId}`}
            description="Результаты расчёта дефицита, сроков действия и рисков."
            right={
              <Link
                to="/licenses"
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Database className="h-4 w-4" />
                Реестр лицензий
              </Link>
            }
          />

          {loading ? (
            <TableSkeleton rows={8} cols={8} />
          ) : err ? (
            <TableEmpty
              title="Ошибка загрузки"
              description="Проверьте соединение и попробуйте обновить данные."
            />
          ) : sorted.length === 0 ? (
            <TableEmpty
              title="Ничего не найдено"
              description="Снимите фильтры или измените поисковый запрос."
            />
          ) : (
            <TableScroll className="max-h-[42vh]">
              <TableInner stickyHeader density="comfortable" className="w-full table-auto">
                <THead>
                  <tr>
                    <SortTh
                      label="Риск"
                      dir={sortKey === "risk" ? sortDir : null}
                      onToggle={() => toggleSort("risk", "desc")}
                      hint="Сортировать по вычисленному риску"
                      className="w-[11%]"
                    />
                    <SortTh
                      label="Продукт"
                      dir={sortKey === "product" ? sortDir : null}
                      onToggle={() => toggleSort("product", "asc")}
                      hint="Сортировать по продукту"
                      className="w-[25%]"
                    />
                    <SortTh
                      label="Тип лицензии"
                      dir={sortKey === "license_type" ? sortDir : null}
                      onToggle={() => toggleSort("license_type", "asc")}
                      hint="Сортировать по типу лицензии"
                      className="w-[15%]"
                    />
                    <SortTh
                      label="Потребность"
                      dir={sortKey === "demand" ? sortDir : null}
                      onToggle={() => toggleSort("demand", "desc")}
                      hint="Сортировать по потребности"
                      className="w-[10%]"
                    />
                    <SortTh
                      label="Лицензии"
                      dir={sortKey === "licenses" ? sortDir : null}
                      onToggle={() => toggleSort("licenses", "desc")}
                      hint="Сортировать по количеству лицензий"
                      className="w-[10%]"
                    />
                    <SortTh
                      label="Дельта"
                      dir={sortKey === "delta" ? sortDir : null}
                      onToggle={() => toggleSort("delta", "asc")}
                      hint="Сортировать по дельте"
                      className="w-[9%]"
                    />
                    <SortTh
                      label="Срок"
                      dir={sortKey === "expires_soon" ? sortDir : null}
                      onToggle={() => toggleSort("expires_soon", "desc")}
                      hint="Сортировать по признаку истечения"
                      className="w-[10%]"
                    />
                    <SortTh label="Реестр" dir={null} className="w-[10%]" />
                  </tr>
                </THead>

                <TBody>
                  {sorted.map((r, idx) => {
                    const rr = derivedRisk(r);
                    const pill = riskPill(rr);

                    const demand = safeNum(r.demand);
                    const licenses = safeNum(r.licenses);
                    const delta = safeNum(r.delta);
                    const expSoon = isExpSoon(r.expires_soon);
                    const productName = str(r.product);

                    return (
                      <Tr key={idx}>
                        <Td className="whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap",
                              pill.cls
                            )}
                          >
                            {pill.icon}
                            {pill.label}
                          </span>
                        </Td>

                        <Td className="font-semibold text-slate-900">
                          <Link
                            to={`/licenses?q=${encodeURIComponent(productName)}`}
                            className="break-words leading-snug hover:underline underline-offset-4"
                            title="Открыть продукт в реестре лицензий"
                          >
                            {productName}
                          </Link>
                        </Td>

                        <Td className="whitespace-nowrap text-slate-600">
                          {str(r.license_type)}
                        </Td>

                        <Td className="whitespace-nowrap tabular-nums text-slate-700">
                          {formatInt(demand)}
                        </Td>

                        <Td className="whitespace-nowrap tabular-nums text-slate-700">
                          {formatInt(licenses)}
                        </Td>

                        <Td
                          className={cn(
                            "whitespace-nowrap tabular-nums font-semibold",
                            delta > 0
                              ? "text-red-700"
                              : delta < 0
                                ? "text-emerald-700"
                                : "text-slate-700"
                          )}
                          title="Потребность − лицензии"
                        >
                          {formatInt(delta)}
                        </Td>

                        <Td className="whitespace-nowrap">
                          {expSoon ? (
                            <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                              <TimerReset className="h-4 w-4" />
                              Да
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </Td>

                        <Td>
                          <Link
                            to={`/licenses?q=${encodeURIComponent(productName)}`}
                            className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Database className="h-4 w-4" />
                            Открыть
                          </Link>
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

      {mappingCreateOpen && (
        <div className="fixed inset-0 z-[9990]">
          <button
            type="button"
            aria-label="Закрыть окно"
            onClick={closeCreateRuleModal}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          <div
            className={cn(
              "absolute left-1/2 top-1/2 w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2",
              "max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-slate-300 bg-white p-5",
              "shadow-[0_18px_60px_rgba(15,23,42,0.24)]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Правило сопоставления
                </div>

                <div className="mt-1 text-lg font-semibold text-slate-950">
                  Создать правило из несопоставленной строки
                </div>

                <div className="mt-2 text-sm leading-6 text-slate-600">
                  После сохранения правила система автоматически запустит новую проверку.
                </div>
              </div>

              <button
                type="button"
                onClick={closeCreateRuleModal}
                disabled={mappingCreateBusy}
                className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              {selectedUnmatched && (
                <ModalInfoCard
                  title="Исходная несопоставленная строка"
                  icon={<TriangleAlert className="h-4 w-4 text-amber-600" />}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        ПО
                      </div>
                      <div className="mt-1 font-medium text-slate-900">
                        {selectedUnmatched.software_name}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Версия
                      </div>
                      <div className="mt-1 text-slate-700">
                        {selectedUnmatched.software_version || "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Устройство
                      </div>
                      <div className="mt-1 text-slate-700">
                        {selectedUnmatched.device || "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Пользователь
                      </div>
                      <div className="mt-1 text-slate-700">
                        {selectedUnmatched.user || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Причина
                    </div>
                    <div className="mt-1 text-slate-700">
                      {selectedUnmatched.reason || "—"}
                    </div>
                  </div>
                </ModalInfoCard>
              )}

              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">
                  Pattern
                </div>
                <input
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="Например: jetbrains"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-slate-500">
                  Каноническое название продукта
                </div>
                <input
                  value={newCanonicalProduct}
                  onChange={(e) => setNewCanonicalProduct(e.target.value)}
                  placeholder="Например: JetBrains"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">
                    Тип сопоставления
                  </div>

                  <button
                    ref={createMatchTypeAnchorRef}
                    type="button"
                    onClick={() => setCreateMatchTypeOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition hover:bg-slate-50 focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                  >
                    <span>{getMatchTypeSelectLabel(newMatchType)}</span>
                  </button>

                  <Dropdown
                    open={createMatchTypeOpen}
                    onClose={() => setCreateMatchTypeOpen(false)}
                    anchorRef={createMatchTypeAnchorRef}
                    width={Math.max(
                      createMatchTypeAnchorRef.current?.offsetWidth ?? 220,
                      220
                    )}
                    align="start"
                    className="p-1"
                  >
                    <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {[
                        { value: "contains", label: "Содержит" },
                        { value: "exact", label: "Точное совпадение" },
                        { value: "regex", label: "Регулярное выражение" },
                      ].map((option) => {
                        const active = newMatchType === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setNewMatchType(option.value);
                              setCreateMatchTypeOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                              active
                                ? "bg-slate-100 text-slate-950"
                                : "text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </Dropdown>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium text-slate-500">
                    Продукт из справочника
                  </div>

                  <button
                    ref={createProductAnchorRef}
                    type="button"
                    onClick={() => setCreateProductDropdownOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition hover:bg-slate-50 focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                  >
                    <span className="truncate text-left">
                      {getProductSelectLabel(products, newProductId)}
                    </span>
                  </button>

                  <Dropdown
                    open={createProductDropdownOpen}
                    onClose={() => setCreateProductDropdownOpen(false)}
                    anchorRef={createProductAnchorRef}
                    width={Math.max(
                      createProductAnchorRef.current?.offsetWidth ?? 320,
                      320
                    )}
                    align="start"
                    className="p-1"
                  >
                    <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => handleCreateProductSelect("")}
                        className={cn(
                          "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                          !newProductId
                            ? "bg-slate-100 text-slate-950"
                            : "text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        Не выбран
                      </button>

                      {products.map((product) => {
                        const active = newProductId === String(product.id);

                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleCreateProductSelect(String(product.id))}
                            className={cn(
                              "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                              active
                                ? "bg-slate-100 text-slate-950"
                                : "text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            <span className="truncate">
                              {product.name}
                              {product.vendor ? ` — ${product.vendor}` : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </Dropdown>
                </div>
              </div>

              <ModalInfoCard
                title="Предпросмотр покрытия"
                icon={<Boxes className="h-4 w-4 text-blue-600" />}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold",
                      selectedPreviewHit
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {selectedPreviewHit ? (
                      <>
                        <CircleCheck className="h-4 w-4" />
                        Текущая строка будет покрыта
                      </>
                    ) : (
                      <>
                        <TriangleAlert className="h-4 w-4" />
                        Текущая строка не покрывается
                      </>
                    )}
                  </span>

                  <span className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    Потенциально покроется: {formatInt(previewMatches.length)}
                  </span>
                </div>

                {newMatchType === "regex" &&
                  newPattern.trim() &&
                  previewMatches.length === 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Regex пока ничего не покрывает в unmatched текущего запуска.
                      Проверьте выражение перед сохранением.
                    </div>
                  )}

                {previewMatches.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                      Первые совпадения текущего запуска
                    </div>

                    <div className="space-y-2">
                      {previewMatches.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-lg border px-3 py-2",
                            selectedUnmatched?.id === item.id
                              ? "border-blue-200 bg-blue-50"
                              : "border-slate-200 bg-slate-50"
                          )}
                        >
                          <div className="font-medium text-slate-900">
                            {item.software_name}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {item.software_version || "—"} · {item.device || "—"} ·{" "}
                            {item.user || "—"}
                          </div>
                        </div>
                      ))}
                    </div>

                    {previewMatches.length > 5 && (
                      <div className="text-xs text-slate-500">
                        И ещё {formatInt(previewMatches.length - 5)} строк(и).
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">
                    Пока совпадений нет. Измените pattern или тип сопоставления.
                  </div>
                )}
              </ModalInfoCard>

              {mappingCreateError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {mappingCreateError}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={closeCreateRuleModal}
                disabled={mappingCreateBusy}
              >
                Отмена
              </Button>

              <Button
                size="sm"
                onClick={() => void handleCreateRule()}
                disabled={mappingCreateBusy}
              >
                <Boxes className="h-4 w-4" />
                {mappingCreateBusy ? "Создание и запуск..." : "Создать правило и пересчитать"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}