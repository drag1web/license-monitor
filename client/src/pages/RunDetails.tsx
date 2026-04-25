import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getRunResults,
  getRunUnmatched,
  getProducts,
  createMappingRule,
  type ResultRow,
  type UnmatchedRow,
  type ProductRow,
} from "../api";

import { Card } from "../ui/Card";
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
  if (s === "no" || s === "n" || s === "false" || s === "—" || s === "") return false;
  return safeNum(v) > 0;
}

/**
 * Источник правды по риску:
 * - delta > 0 => дефицит => HIGH
 * - expires_soon => WARN
 * - иначе OK
 */
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
    .filter((row) => doesPatternMatch(row.software_name ?? "", normalizedPattern, matchType))
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
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08]",
        "bg-gradient-to-b from-white/[0.05] to-white/[0.02]",
        "p-4"
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/85">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-2 text-sm text-white/65">{children}</div>
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
  if (value === "exact") return "Exact";
  if (value === "contains") return "Contains";
  if (value === "regex") return "Regex";
  return "Contains";
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

  const toast = useToast();

  const [unmatchedRows, setUnmatchedRows] = useState<UnmatchedRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedUnmatched, setSelectedUnmatched] = useState<UnmatchedRow | null>(null);

  const [mappingCreateOpen, setMappingCreateOpen] = useState(false);
  const [mappingCreateBusy, setMappingCreateBusy] = useState(false);
  const [mappingCreateError, setMappingCreateError] = useState("");

  const [newPattern, setNewPattern] = useState("");
  const [newCanonicalProduct, setNewCanonicalProduct] = useState("");
  const [newMatchType, setNewMatchType] = useState("contains");
  const [newProductId, setNewProductId] = useState("");

  const [createProductDropdownOpen, setCreateProductDropdownOpen] = useState(false);
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

  async function handleCreateRule() {
    const pattern = newPattern.trim();
    const canonicalProduct = newCanonicalProduct.trim();
    const productId = newProductId.trim();
    const matches = previewMatches.length;

    setLastCreatedRule({
      pattern,
      matches,
    });

    if (!pattern) {
      setMappingCreateError("Укажи pattern.");
      return;
    }

    if (!canonicalProduct) {
      setMappingCreateError("Укажи каноническое название продукта.");
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

      setMappingCreateOpen(false);
      setSelectedUnmatched(null);
      setCreateProductDropdownOpen(false);
      setCreateMatchTypeOpen(false);
      setMappingCreateError("");

      await refresh();

      toast.push({
        tone: "success",
        title: "Правило создано",
        message: `Добавлено правило "${pattern}". Несопоставленные строки обновлены.`,
      });
    } catch (e) {
      setMappingCreateError(
        e instanceof Error ? e.message : "Не удалось создать правило сопоставления"
      );
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

  const previewMatches = useMemo(() => {
    return buildPreviewMatches(unmatchedRows, newPattern, newMatchType);
  }, [unmatchedRows, newPattern, newMatchType]);

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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Высокий риск"
              value={formatInt(stats.high)}
              hint="Дефицит / высокий риск"
              tone={stats.high > 0 ? "bad" : "ok"}
            />
            <StatCard
              label="Предупреждения"
              value={formatInt(stats.med)}
              hint="Истекающие / средний риск"
              tone={stats.med > 0 ? "warn" : "ok"}
            />
            <StatCard
              label="Скоро истекают"
              value={formatInt(stats.expSoon)}
              hint="Лицензии с близким сроком окончания"
              tone={stats.expSoon > 0 ? "warn" : "ok"}
            />
            <StatCard
              label="Суммарная дельта"
              value={formatInt(stats.sumDelta)}
              hint="demand - licenses"
              tone={stats.sumDelta > 0 ? "bad" : stats.sumDelta < 0 ? "ok" : "none"}
            />
            <StatCard
              label="Unmatched строки"
              value={formatInt(unmatchedRows.length)}
              hint="Несопоставленные установки этого запуска"
              tone={unmatchedRows.length > 0 ? "warn" : "ok"}
            />
          </div>
        </div>
      </Card>

      {mappingCreateOpen && newPattern.trim() && (
        <Card className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-cyan-100">
                Предпросмотр покрытия unmatched
              </div>
              <div className="mt-1 text-xs text-cyan-200/80">
                Pattern: <span className="font-mono">{newPattern}</span> · Match type:{" "}
                <span className="font-medium">{getMatchTypeSelectLabel(newMatchType)}</span> ·
                Потенциально покроется строк:{" "}
                <span className="font-semibold">{formatInt(previewMatches.length)}</span>
              </div>
            </div>

            {selectedUnmatched && (
              <div className="text-xs text-cyan-100/80">
                Текущая строка:{" "}
                <span className="font-medium text-cyan-100">
                  {selectedUnmatched.software_name}
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
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
            <FilterPill label="Все" active={onlyRisk === "all"} onClick={() => setOnlyRisk("all")} />
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
          Показано:{" "}
          <span className="font-semibold text-white/70">{formatInt(sorted.length)}</span> из{" "}
          <span className="font-semibold text-white/70">{formatInt(rows.length)}</span>
        </div>
      </Card>

      {lastCreatedRule && (
        <Card className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">

            <div className="flex-1">
              <div className="text-sm font-semibold text-emerald-100">
                Правило создано
              </div>
              <div className="text-xs text-emerald-200/80 mt-1">
                Pattern: <span className="font-mono">{lastCreatedRule.pattern}</span> ·
                Покроет строк: {formatInt(lastCreatedRule.matches)}
              </div>
            </div>

            <div className="flex gap-2">
              <SoftButton
                variant="primary"
                onClick={() => {
                  // потом сделаем нормальный run trigger
                  refresh();
                }}
              >
                Запустить проверку
              </SoftButton>

              <Link to="/dictionaries/mapping">
                <SoftButton>
                  Открыть правила
                </SoftButton>
              </Link>

              <SoftButton onClick={() => setLastCreatedRule(null)}>
                Закрыть
              </SoftButton>
            </div>
          </div>
        </Card>
      )}



      <Card className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-0 overflow-hidden">
        <Table>
          <TableCaption
            title="Несопоставленные установки"
            description="Строки, для которых не нашлось правила сопоставления."
            right={
              <div className="text-[11px] text-white/45">
                {loading ? "Обновляю…" : `Строк: ${formatInt(unmatchedRows.length)}`}
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
                    <SortTh label="версия" dir={null} className="w-[10%]" />
                    <SortTh label="устройство" dir={null} className="w-[13%]" />
                    <SortTh label="пользователь" dir={null} className="w-[14%]" />
                    <SortTh label="причина" dir={null} className="w-[23%]" />
                    <SortTh label="действия" dir={null} className="w-[12%]" />
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
                          isSelected &&
                          "bg-cyan-500/14 ring-1 ring-inset ring-cyan-300/25",
                          !isSelected &&
                          isPreviewMatch &&
                          "bg-emerald-500/10 ring-1 ring-inset ring-emerald-300/15"
                        )}
                      >
                        <Td className="font-semibold text-white/85">
                          <div className="break-words leading-snug">{row.software_name}</div>
                        </Td>

                        <Td className="text-white/70 whitespace-nowrap">
                          {row.software_version || "—"}
                        </Td>

                        <Td className="text-white/70 whitespace-nowrap">
                          {row.device || "—"}
                        </Td>

                        <Td className="text-white/70 whitespace-nowrap">
                          {row.user || "—"}
                        </Td>

                        <Td className="text-white/70">
                          <div className="flex flex-col gap-2">
                            <div className="whitespace-normal break-words leading-snug">
                              {row.reason || "—"}
                            </div>

                            {selectedUnmatched?.id === row.id ? (
                              <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                                Текущая строка
                              </span>
                            ) : previewMatchIds.has(row.id) ? (
                              <span className="inline-flex w-fit items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                                Покроется правилом
                              </span>
                            ) : null}
                          </div>
                        </Td>

                        <Td>
                          {isAdmin ? (
                            <SoftButton
                              className="w-full justify-center"
                              variant="primary"
                              onClick={() => openCreateRuleFromUnmatched(row)}
                              leftIcon={<Plus className="h-4 w-4" />}
                            >
                              Правило
                            </SoftButton>
                          ) : (
                            <span className="text-xs text-white/40">Только просмотр</span>
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

      <Card
        id="results-table"
        className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-0 overflow-hidden"
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
            <TableScroll className="max-h-[42vh]">
              <TableInner stickyHeader density="comfortable" className="w-full table-auto">
                <THead>
                  <tr>
                    <SortTh
                      label="риск"
                      dir={sortKey === "risk" ? sortDir : null}
                      onToggle={() => toggleSort("risk", "desc")}
                      hint="Сортировать по вычисленному риску"
                      className="w-[11%]"
                    />
                    <SortTh
                      label="продукт"
                      dir={sortKey === "product" ? sortDir : null}
                      onToggle={() => toggleSort("product", "asc")}
                      hint="Сортировать по продукту"
                      className="w-[29%]"
                    />
                    <SortTh
                      label="тип лицензии"
                      dir={sortKey === "license_type" ? sortDir : null}
                      onToggle={() => toggleSort("license_type", "asc")}
                      hint="Сортировать по типу лицензии"
                      className="w-[16%]"
                    />
                    <SortTh
                      label="потребность"
                      dir={sortKey === "demand" ? sortDir : null}
                      onToggle={() => toggleSort("demand", "desc")}
                      hint="Сортировать по потребности"
                      className="w-[10%]"
                    />
                    <SortTh
                      label="лицензии"
                      dir={sortKey === "licenses" ? sortDir : null}
                      onToggle={() => toggleSort("licenses", "desc")}
                      hint="Сортировать по количеству лицензий"
                      className="w-[10%]"
                    />
                    <SortTh
                      label="дельта"
                      dir={sortKey === "delta" ? sortDir : null}
                      onToggle={() => toggleSort("delta", "asc")}
                      hint="Сортировать по дельте"
                      className="w-[9%]"
                    />
                    <SortTh
                      label="скоро истекают"
                      dir={sortKey === "expires_soon" ? sortDir : null}
                      onToggle={() => toggleSort("expires_soon", "desc")}
                      hint="Сортировать по признаку истечения"
                      className="w-[15%]"
                    />
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

                    return (
                      <Tr key={idx}>
                        <Td className="whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border whitespace-nowrap",
                              pill.cls
                            )}
                          >
                            {pill.icon}
                            {pill.label}
                          </span>
                        </Td>

                        <Td className="font-semibold text-white/85">
                          <div className="break-words leading-snug">{str(r.product)}</div>
                        </Td>

                        <Td className="text-white/70 whitespace-nowrap">
                          {str(r.license_type)}
                        </Td>

                        <Td className="tabular-nums whitespace-nowrap">{formatInt(demand)}</Td>
                        <Td className="tabular-nums whitespace-nowrap">{formatInt(licenses)}</Td>

                        <Td
                          className={cn(
                            "tabular-nums font-semibold whitespace-nowrap",
                            delta > 0
                              ? "text-rose-200"
                              : delta < 0
                                ? "text-emerald-200"
                                : "text-white/75"
                          )}
                          title="demand - licenses"
                        >
                          {formatInt(delta)}
                        </Td>

                        <Td className="whitespace-nowrap">
                          {expSoon ? (
                            <span className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border border-amber-300/20 bg-amber-500/10 text-amber-100 whitespace-nowrap">
                              <TimerReset className="h-4 w-4" />
                              Да
                            </span>
                          ) : (
                            <span className="text-white/55">—</span>
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

      {mappingCreateOpen && (
        <div className="fixed inset-0 z-[9990]">
          <button
            type="button"
            aria-label="Close modal"
            onClick={closeCreateRuleModal}
            className="absolute inset-0 bg-black/60 bg-[radial-gradient(1200px_600px_at_50%_20%,rgba(0,255,255,0.08),transparent_55%),radial-gradient(900px_500px_at_20%_80%,rgba(255,0,128,0.06),transparent_55%)] backdrop-blur-[2px]"
          />

          <div
            className={cn(
              "absolute left-1/2 top-1/2 w-[min(720px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2",
              "rounded-[28px] border border-white/10 bg-[rgb(var(--panel))]/98",
              "shadow-[0_30px_90px_rgba(0,0,0,0.60)] p-5"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] text-white/55">Mapping rule</div>
                <div className="mt-1 text-lg font-semibold text-white/90">
                  Создать правило из unmatched строки
                </div>
                <div className="mt-2 text-sm text-white/60">
                  Быстрое создание правила сопоставления на основе проблемной установки.
                </div>
              </div>

              <button
                type="button"
                onClick={closeCreateRuleModal}
                disabled={mappingCreateBusy}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white/90 disabled:opacity-50"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              {selectedUnmatched && (
                <ModalInfoCard
                  title="Исходная unmatched-строка"
                  icon={<TriangleAlert className="h-4 w-4 text-amber-200/80" />}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-white/40">ПО</div>
                      <div className="mt-1 font-medium text-white/85">
                        {selectedUnmatched.software_name}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-white/40">Версия</div>
                      <div className="mt-1 text-white/75">
                        {selectedUnmatched.software_version || "—"}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-white/40">
                        Устройство
                      </div>
                      <div className="mt-1 text-white/75">{selectedUnmatched.device || "—"}</div>
                    </div>

                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-white/40">
                        Пользователь
                      </div>
                      <div className="mt-1 text-white/75">{selectedUnmatched.user || "—"}</div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <div className="text-[11px] uppercase tracking-wide text-white/40">Причина</div>
                    <div className="mt-1 text-white/75">{selectedUnmatched.reason || "—"}</div>
                  </div>
                </ModalInfoCard>
              )}

              <div>
                <div className="mb-2 text-xs font-medium text-white/55">Pattern</div>
                <input
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="Например: jetbrains"
                  className={cn(
                    "w-full rounded-2xl border border-white/10 bg-black/25",
                    "px-3 py-2.5 text-sm text-white/85 outline-none",
                    "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                  )}
                />
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-white/55">
                  Каноническое название продукта
                </div>
                <input
                  value={newCanonicalProduct}
                  onChange={(e) => setNewCanonicalProduct(e.target.value)}
                  placeholder="Например: JetBrains"
                  className={cn(
                    "w-full rounded-2xl border border-white/10 bg-black/25",
                    "px-3 py-2.5 text-sm text-white/85 outline-none",
                    "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-medium text-white/55">Match type</div>

                  <button
                    ref={createMatchTypeAnchorRef}
                    type="button"
                    onClick={() => setCreateMatchTypeOpen((v) => !v)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25",
                      "px-3 py-2.5 text-sm text-white/85 outline-none transition",
                      "hover:border-white/15 hover:bg-black/30",
                      "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                    )}
                  >
                    <span>{getMatchTypeSelectLabel(newMatchType)}</span>
                  </button>

                  <Dropdown
                    open={createMatchTypeOpen}
                    onClose={() => setCreateMatchTypeOpen(false)}
                    anchorRef={createMatchTypeAnchorRef}
                    width={Math.max(createMatchTypeAnchorRef.current?.offsetWidth ?? 220, 220)}
                    align="start"
                    className="p-1"
                  >
                    {[
                      { value: "contains", label: "Contains" },
                      { value: "exact", label: "Exact" },
                      { value: "regex", label: "Regex" },
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
                            "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition",
                            active
                              ? "bg-cyan-300/14 text-cyan-100"
                              : "text-white/78 hover:bg-white/[0.05] hover:text-white"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </Dropdown>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-white/55">
                    Продукт из справочника (опционально)
                  </div>

                  <button
                    ref={createProductAnchorRef}
                    type="button"
                    onClick={() => setCreateProductDropdownOpen((v) => !v)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25",
                      "px-3 py-2.5 text-sm text-white/85 outline-none transition",
                      "hover:border-white/15 hover:bg-black/30",
                      "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                    )}
                  >
                    <span className="truncate text-left">
                      {getProductSelectLabel(products, newProductId)}
                    </span>
                  </button>

                  <Dropdown
                    open={createProductDropdownOpen}
                    onClose={() => setCreateProductDropdownOpen(false)}
                    anchorRef={createProductAnchorRef}
                    width={Math.max(createProductAnchorRef.current?.offsetWidth ?? 320, 320)}
                    align="start"
                    className="p-1"
                  >
                    <button
                      type="button"
                      onClick={() => handleCreateProductSelect("")}
                      className={cn(
                        "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition",
                        !newProductId
                          ? "bg-cyan-300/14 text-cyan-100"
                          : "text-white/78 hover:bg-white/[0.05] hover:text-white"
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
                            "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition",
                            active
                              ? "bg-cyan-300/14 text-cyan-100"
                              : "text-white/78 hover:bg-white/[0.05] hover:text-white"
                          )}
                        >
                          <span className="truncate">
                            {product.name}
                            {product.vendor ? ` — ${product.vendor}` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </Dropdown>
                </div>
              </div>

              <ModalInfoCard
                title="Предпросмотр покрытия"
                icon={<Boxes className="h-4 w-4 text-cyan-200/80" />}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border",
                      selectedPreviewHit
                        ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                        : "border-rose-300/20 bg-rose-500/10 text-rose-100"
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

                  <span className="inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
                    Потенциально покроется: {formatInt(previewMatches.length)}
                  </span>
                </div>

                {newMatchType === "regex" && newPattern.trim() && previewMatches.length === 0 && (
                  <div className="rounded-2xl border border-amber-300/15 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                    Regex пока ничего не покрывает в unmatched текущего запуска. Проверь
                    выражение перед сохранением.
                  </div>
                )}

                {previewMatches.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-white/40">
                      Первые совпадения текущего запуска
                    </div>

                    <div className="space-y-2">
                      {previewMatches.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-2xl border px-3 py-2",
                            selectedUnmatched?.id === item.id
                              ? "border-cyan-300/20 bg-cyan-500/10"
                              : "border-white/[0.08] bg-white/[0.03]"
                          )}
                        >
                          <div className="font-medium text-white/85">{item.software_name}</div>
                          <div className="mt-1 text-xs text-white/50">
                            {item.software_version || "—"} · {item.device || "—"} ·{" "}
                            {item.user || "—"}
                          </div>
                        </div>
                      ))}
                    </div>

                    {previewMatches.length > 5 && (
                      <div className="text-xs text-white/45">
                        И ещё {formatInt(previewMatches.length - 5)} строк(и).
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-white/55">
                    Пока совпадений нет. Измени pattern или match type.
                  </div>
                )}
              </ModalInfoCard>

              {mappingCreateError && (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
                  {mappingCreateError}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <SoftButton onClick={closeCreateRuleModal} disabled={mappingCreateBusy}>
                Отмена
              </SoftButton>

              <SoftButton
                variant="primary"
                onClick={() => void handleCreateRule()}
                disabled={mappingCreateBusy}
                leftIcon={<Boxes className="h-4 w-4" />}
              >
                {mappingCreateBusy ? "Создание..." : "Создать правило"}
              </SoftButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}