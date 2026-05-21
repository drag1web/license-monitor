import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  GitBranch,
  Search,
  Plus,
  Filter,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Boxes,
  ChevronDown,
  X,
  Play,
} from "lucide-react";

import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "../ui/modal/ConfirmDialog";
import { useConfirmDialog } from "../ui/modal/useConfirmDialog";
import { Dropdown } from "../components/Dropdown";
import { useToast } from "../ui/toast";
import { cn } from "../ui/cn/cn";
import {
  getMappingRules,
  getProducts,
  createMappingRule,
  updateMappingRule,
  deleteMappingRule,
  testMappingRule,
  runCheck,
  type MappingRuleRow,
  type ProductRow,
} from "../api";
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
} from "../ui/Table";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function getProductLabel(rule: MappingRuleRow, products?: ProductRow[]) {
  if (rule.product_id && products?.length) {
    const linked = products.find((p) => p.id === rule.product_id);
    if (linked) return linked.name;
  }

  return (
    rule.canonical_product?.trim() ||
    rule.product_name?.trim() ||
    (rule.product_id ? `#${rule.product_id}` : "")
  );
}

function getMatchTypeLabel(value?: string | null) {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "exact") return "Точно";
  if (v === "contains") return "Содержит";
  if (v === "regex") return "Regex";
  return v || "—";
}

function getMatchTypeTone(value?: string | null) {
  const v = (value ?? "").trim().toLowerCase();

  if (v === "exact") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (v === "contains") return "border-blue-200 bg-blue-50 text-blue-700";
  if (v === "regex") return "border-violet-200 bg-violet-50 text-violet-700";

  return "border-slate-200 bg-slate-50 text-slate-600";
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

function getFilterProductLabel(products: ProductRow[], rawId: string) {
  const selected = getSelectedProductById(products, rawId);
  if (!selected) return "Все продукты";
  return selected.vendor ? `${selected.name} — ${selected.vendor}` : selected.name;
}

function getFilterMatchTypeLabel(value: string) {
  if (!value) return "Все типы";
  if (value === "exact") return "Точно";
  if (value === "contains") return "Содержит";
  if (value === "regex") return "Regex";
  return value;
}

function getMatchTypeSelectLabel(value: string) {
  if (value === "exact") return "Точно";
  if (value === "contains") return "Содержит";
  if (value === "regex") return "Regex";
  return "Содержит";
}

function getSortLabel(value: string) {
  switch (value) {
    case "updated_desc":
      return "Сначала обновлённые";
    case "updated_asc":
      return "Сначала старые обновления";
    case "created_desc":
      return "Сначала новые";
    case "created_asc":
      return "Сначала старые";
    case "pattern_asc":
      return "Pattern A → Z";
    case "pattern_desc":
      return "Pattern Z → A";
    default:
      return "Сортировка";
  }
}

function MiniStat({
  label,
  value,
  tone = "none",
  icon,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad" | "none";
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
        tone === "ok" && "border-emerald-200",
        tone === "warn" && "border-amber-200",
        tone === "bad" && "border-red-200",
        tone === "none" && "border-slate-200"
      )}
    >
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        <span>{label}</span>
      </div>

      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "ok" && "text-emerald-700",
          tone === "warn" && "text-amber-700",
          tone === "bad" && "text-red-700",
          tone === "none" && "text-slate-950"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none",
        "placeholder:text-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-100",
        props.className
      )}
    />
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-xs font-medium text-slate-500">{children}</div>;
}

function SelectDropdownButton({
  refProp,
  onClick,
  children,
}: {
  refProp: React.RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={refProp}
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 transition hover:bg-slate-50"
    >
      <span className="truncate text-left">{children}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

export default function DictionariesMapping() {
  const { user } = useAuth();
  const { push } = useToast();
  const canManage = user?.role === "admin";
  const navigate = useNavigate();

  const [mappingChanged, setMappingChanged] = useState(false);
  const [runBusy, setRunBusy] = useState(false);

  const [items, setItems] = useState<MappingRuleRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const confirmDelete = useConfirmDialog();

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [editingRule, setEditingRule] = useState<MappingRuleRow | null>(null);

  const [editPattern, setEditPattern] = useState("");
  const [editCanonicalProduct, setEditCanonicalProduct] = useState("");
  const [editMatchType, setEditMatchType] = useState("contains");
  const [editProductId, setEditProductId] = useState("");

  const [newPattern, setNewPattern] = useState("");
  const [newCanonicalProduct, setNewCanonicalProduct] = useState("");
  const [newMatchType, setNewMatchType] = useState("contains");
  const [newProductId, setNewProductId] = useState("");

  const [createProductDropdownOpen, setCreateProductDropdownOpen] = useState(false);
  const [editProductDropdownOpen, setEditProductDropdownOpen] = useState(false);

  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [matchTypeFilterOpen, setMatchTypeFilterOpen] = useState(false);

  const [selectedProductFilter, setSelectedProductFilter] = useState("");
  const [selectedMatchTypeFilter, setSelectedMatchTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<
    | "updated_desc"
    | "updated_asc"
    | "created_desc"
    | "created_asc"
    | "pattern_asc"
    | "pattern_desc"
  >("updated_desc");
  const [sortOpen, setSortOpen] = useState(false);

  const productFilterAnchorRef = useRef<HTMLButtonElement | null>(null);
  const matchTypeFilterAnchorRef = useRef<HTMLButtonElement | null>(null);
  const sortAnchorRef = useRef<HTMLButtonElement | null>(null);

  const createProductAnchorRef = useRef<HTMLButtonElement | null>(null);
  const editProductAnchorRef = useRef<HTMLButtonElement | null>(null);

  const [createMatchTypeOpen, setCreateMatchTypeOpen] = useState(false);
  const [editMatchTypeOpen, setEditMatchTypeOpen] = useState(false);

  const createMatchTypeAnchorRef = useRef<HTMLButtonElement | null>(null);
  const editMatchTypeAnchorRef = useRef<HTMLButtonElement | null>(null);

  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testBusy, setTestBusy] = useState(false);


  async function runCheckAndOpen() {
    if (!canManage) return;

    setRunBusy(true);
    setError("");

    try {
      const out = await runCheck();

      if (!out.ok) {
        throw new Error(out.error || "Не удалось запустить проверку");
      }

      setMappingChanged(false);
      window.dispatchEvent(new CustomEvent("alerts:refresh"));

      if (out.runId) {
        push({
          tone: "success",
          title: "Проверка завершена",
          message: `Открываю новый запуск #${out.runId}.`,
        });

        navigate(`/runs/${out.runId}`);
        return;
      }

      navigate("/runs");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      setError(msg);

      push({
        tone: "error",
        title: "Ошибка проверки",
        message: msg,
      });
    } finally {
      setRunBusy(false);
    }
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [rows, productRows] = await Promise.all([
        getMappingRules(),
        getProducts(),
      ]);

      setItems(Array.isArray(rows) ? rows : []);
      setProducts(Array.isArray(productRows) ? productRows : []);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось загрузить правила сопоставления"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(rule: MappingRuleRow) {
    const ok = await confirmDelete.ask({
      title: "Удалить правило сопоставления?",
      description: `Правило "${rule.pattern}"${getProductLabel(rule, products)
        ? ` для продукта "${getProductLabel(rule, products)}"`
        : ""
        } будет удалено без возможности быстрого восстановления.`,
      confirmLabel: "Удалить",
      cancelLabel: "Отмена",
      danger: true,
    });

    if (!ok) return;

    setDeleteBusy(true);

    try {
      await deleteMappingRule(rule.id);
      await load();
      setMappingChanged(true);

      push({
        tone: "success",
        title: "Правило удалено",
        message: `Правило "${rule.pattern}" удалено. Для обновления результатов запустите проверку.`,
        action: {
          label: "Запустить",
          onClick: () => void runCheckAndOpen(),
        },
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Не удалось удалить правило сопоставления"
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  function openCreateModal() {
    setCreateError("");
    setNewPattern("");
    setNewCanonicalProduct("");
    setNewMatchType("contains");
    setNewProductId("");
    setCreateOpen(true);
    setCreateProductDropdownOpen(false);
    setCreateMatchTypeOpen(false);
  }

  function openCreateModalFromTest() {
    const value = testInput.trim();
    if (!value) return;

    setCreateError("");
    setNewPattern(value);
    setNewCanonicalProduct(value);
    setNewMatchType("contains");
    setNewProductId("");
    setCreateOpen(true);
    setCreateProductDropdownOpen(false);
    setCreateMatchTypeOpen(false);
  }

  function closeCreateModal() {
    if (createBusy) return;
    setCreateOpen(false);
    setCreateProductDropdownOpen(false);
    setCreateMatchTypeOpen(false);
  }

  function handleCreateProductSelect(productId: string) {
    setNewProductId(productId);
    setCreateProductDropdownOpen(false);

    const selected = getSelectedProductById(products, productId);
    if (selected) setNewCanonicalProduct(selected.name);
  }

  function handleEditProductSelect(productId: string) {
    setEditProductId(productId);
    setEditProductDropdownOpen(false);

    const selected = getSelectedProductById(products, productId);
    if (selected) setEditCanonicalProduct(selected.name);
  }

  function openEditModal(rule: MappingRuleRow) {
    setEditingRule(rule);
    setEditPattern(rule.pattern ?? "");
    setEditCanonicalProduct(rule.canonical_product ?? rule.product_name ?? "");
    setEditMatchType((rule.match_type ?? "contains").trim() || "contains");
    setEditProductId(rule.product_id ? String(rule.product_id) : "");
    setEditError("");
    setEditOpen(true);
    setEditProductDropdownOpen(false);
    setEditMatchTypeOpen(false);
  }

  function closeEditModal() {
    if (editBusy) return;
    setEditOpen(false);
    setEditingRule(null);
    setEditProductDropdownOpen(false);
    setEditMatchTypeOpen(false);
  }

  async function handleCreateRule() {
    const pattern = newPattern.trim();
    const canonicalProduct = newCanonicalProduct.trim();
    const productId = newProductId.trim();

    if (!pattern) {
      setCreateError("Укажите pattern.");
      return;
    }

    if (!canonicalProduct) {
      setCreateError("Укажите каноническое название продукта.");
      return;
    }

    if (productId && (!Number.isFinite(Number(productId)) || Number(productId) <= 0)) {
      setCreateError("Product ID должен быть положительным числом.");
      return;
    }

    setCreateBusy(true);
    setCreateError("");

    try {
      await createMappingRule({
        pattern,
        canonical_product: canonicalProduct,
        match_type: newMatchType,
        product_id: productId ? Number(productId) : undefined,
      });

      setCreateOpen(false);
      setTestResult(null);
      setTestInput("");
      await load();
      setMappingChanged(true);

      push({
        tone: "success",
        title: "Правило создано",
        message: `Добавлено новое правило "${pattern}". Для применения в результатах запустите проверку.`,
        action: {
          label: "Запустить",
          onClick: () => void runCheckAndOpen(),
        },
      });
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : "Не удалось создать правило сопоставления"
      );
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleUpdateRule() {
    if (!editingRule) return;

    const pattern = editPattern.trim();
    const canonicalProduct = editCanonicalProduct.trim();
    const productId = editProductId.trim();

    if (!pattern) {
      setEditError("Укажите pattern.");
      return;
    }

    if (!canonicalProduct) {
      setEditError("Укажите каноническое название продукта.");
      return;
    }

    if (productId && (!Number.isFinite(Number(productId)) || Number(productId) <= 0)) {
      setEditError("Product ID должен быть положительным числом.");
      return;
    }

    setEditBusy(true);
    setEditError("");

    try {
      await updateMappingRule(editingRule.id, {
        pattern,
        canonical_product: canonicalProduct,
        match_type: editMatchType,
        product_id: productId ? Number(productId) : undefined,
      });

      setEditOpen(false);
      setEditingRule(null);
      await load();
      setMappingChanged(true);

      push({
        tone: "success",
        title: "Изменения сохранены",
        message: `Правило "${pattern}" обновлено. Для применения изменений запустите проверку.`,
        action: {
          label: "Запустить",
          onClick: () => void runCheckAndOpen(),
        },
      });
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "Не удалось обновить правило сопоставления"
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function handleTestRule() {
    const value = testInput.trim();
    if (!value) return;

    setTestBusy(true);
    setTestResult(null);

    try {
      const res = await testMappingRule(value);
      setTestResult(res);
    } catch (e) {
      setTestResult({
        ok: false,
        error: e instanceof Error ? e.message : "Ошибка теста",
      });
    } finally {
      setTestBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let rows = items.filter((item) => {
      const productLabel = getProductLabel(item, products);

      const haystack = [item.pattern, item.match_type ?? "", productLabel]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !q || haystack.includes(q);
      const matchesProduct =
        !selectedProductFilter || String(item.product_id ?? "") === selectedProductFilter;
      const matchesMatchType =
        !selectedMatchTypeFilter ||
        (item.match_type ?? "").trim().toLowerCase() === selectedMatchTypeFilter;

      return matchesQuery && matchesProduct && matchesMatchType;
    });

    rows = [...rows].sort((a, b) => {
      const aUpdated = new Date(a.updated_at ?? "").getTime() || 0;
      const bUpdated = new Date(b.updated_at ?? "").getTime() || 0;
      const aCreated = new Date(a.created_at ?? "").getTime() || 0;
      const bCreated = new Date(b.created_at ?? "").getTime() || 0;
      const aPattern = (a.pattern ?? "").toLowerCase();
      const bPattern = (b.pattern ?? "").toLowerCase();

      switch (sortBy) {
        case "updated_asc":
          return aUpdated - bUpdated;
        case "created_desc":
          return bCreated - aCreated;
        case "created_asc":
          return aCreated - bCreated;
        case "pattern_asc":
          return aPattern.localeCompare(bPattern, "ru");
        case "pattern_desc":
          return bPattern.localeCompare(aPattern, "ru");
        case "updated_desc":
        default:
          return bUpdated - aUpdated;
      }
    });

    return rows;
  }, [items, products, query, selectedProductFilter, selectedMatchTypeFilter, sortBy]);

  const matchTypesCount = useMemo(() => {
    return new Set(
      items.map((x) => (x.match_type ?? "").trim().toLowerCase()).filter(Boolean)
    ).size;
  }, [items]);

  const linkedProductsCount = useMemo(() => {
    return new Set(items.map((x) => getProductLabel(x, products)).filter(Boolean)).size;
  }, [items, products]);

  const hasActiveFilters = Boolean(
    query.trim() ||
    selectedProductFilter ||
    selectedMatchTypeFilter ||
    sortBy !== "updated_desc"
  );

  function resetFilters() {
    setQuery("");
    setSelectedProductFilter("");
    setSelectedMatchTypeFilter("");
    setSortBy("updated_desc");
    setProductFilterOpen(false);
    setMatchTypeFilterOpen(false);
    setSortOpen(false);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <GitBranch className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="text-xl font-semibold text-slate-950">
                Правила сопоставления
              </div>

              <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Нормализация сырых названий ПО в канонические продукты для расчёта дефицита лицензий.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Обновить
            </Button>

            {canManage && (
              <Button size="sm" onClick={openCreateModal}>
                <Plus className="h-4 w-4" />
                Добавить правило
              </Button>
            )}
          </div>
        </div>
      </Card>

      {canManage && mappingChanged && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-900">
                Правила сопоставления изменены
              </div>

              <div className="mt-1 text-xs text-amber-700">
                Чтобы новые правила повлияли на unmatched-строки, дефициты и результаты запусков,
                нужно выполнить повторную проверку.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void runCheckAndOpen()}
                disabled={runBusy}
              >
                <Play className="h-4 w-4" />
                {runBusy ? "Запуск..." : "Запустить проверку"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMappingChanged(false)}
              >
                Скрыть
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MiniStat
          label="Правила"
          value={loading ? 0 : items.length}
          icon={<GitBranch className="h-4 w-4" />}
        />
        <MiniStat
          label="Типы сопоставления"
          value={loading ? 0 : matchTypesCount}
          tone="warn"
          icon={<Filter className="h-4 w-4" />}
        />
        <MiniStat
          label="Связанные продукты"
          value={loading ? 0 : linkedProductsCount}
          tone="ok"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter className="h-4 w-4" />
            <div className="text-sm font-semibold">Фильтры, поиск и действия</div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-slate-100">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по pattern, продукту или типу сопоставления..."
                className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                ref={productFilterAnchorRef}
                type="button"
                onClick={() => setProductFilterOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span className="max-w-[240px] truncate">
                  {getFilterProductLabel(products, selectedProductFilter)}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              <button
                ref={matchTypeFilterAnchorRef}
                type="button"
                onClick={() => setMatchTypeFilterOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span>{getFilterMatchTypeLabel(selectedMatchTypeFilter)}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              <button
                ref={sortAnchorRef}
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span>{getSortLabel(sortBy)}</span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Сбросить
                </Button>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Показано:{" "}
            <span className="font-semibold text-slate-900">{filtered.length}</span>{" "}
            из <span className="font-semibold text-slate-900">{items.length}</span>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-950">
              Тест сопоставления
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Проверьте, какое правило сработает для произвольной строки ПО.
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="flex flex-1 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Например: JetBrains IntelliJ IDEA Ultimate"
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            <Button
              onClick={() => void handleTestRule()}
              disabled={testBusy || !testInput.trim()}
              className="min-w-[140px]"
            >
              {testBusy ? "Проверка..." : "Проверить"}
            </Button>
          </div>

          {testResult && (
            <div
              className={cn(
                "rounded-xl border p-4",
                !testResult.ok
                  ? "border-red-200 bg-red-50"
                  : !testResult.matched
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
              )}
            >
              {!testResult.ok ? (
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
                  <div>
                    <div className="text-sm font-semibold text-red-700">
                      Ошибка проверки
                    </div>
                    <div className="mt-1 text-sm text-red-600">
                      {testResult.error}
                    </div>
                  </div>
                </div>
              ) : !testResult.matched ? (
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                    <div>
                      <div className="text-sm font-semibold text-amber-700">
                        Совпадений не найдено
                      </div>
                      <div className="mt-1 text-sm text-amber-700">
                        Для этой строки пока нет подходящего правила сопоставления.
                      </div>
                    </div>
                  </div>

                  {testInput.trim() && canManage && (
                    <Button size="sm" onClick={openCreateModalFromTest}>
                      Создать правило
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Boxes className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div>
                      <div className="text-sm font-semibold text-emerald-700">
                        Совпадение найдено
                      </div>
                      <div className="mt-1 text-sm text-emerald-700">
                        Строка сопоставлена с существующим правилом.
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Pattern
                      </div>
                      <div className="mt-1 break-words text-sm font-medium text-slate-900">
                        {testResult.rule.pattern}
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Тип
                      </div>
                      <div className="mt-1">
                        <span
                          className={cn(
                            "inline-flex rounded-md border px-2 py-1 text-xs font-medium",
                            getMatchTypeTone(testResult.rule.match_type)
                          )}
                        >
                          {getMatchTypeLabel(testResult.rule.match_type)}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">
                        Продукт
                      </div>
                      <div className="mt-1 break-words text-sm font-medium text-slate-900">
                        {testResult.product?.name ?? testResult.rule.canonical_product}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableCaption
            title="Правила сопоставления"
            description="Правила нормализации сырых названий ПО в канонические продукты."
            right={
              <div className="text-xs text-slate-500">
                {loading ? "Загрузка..." : `Показано: ${filtered.length} / ${items.length}`}
              </div>
            }
          />

          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : filtered.length === 0 ? (
            <TableEmpty
              title={
                items.length === 0
                  ? "Правила сопоставления пока не добавлены"
                  : "Ничего не найдено"
              }
              description={
                items.length === 0
                  ? "После добавления правил они появятся в этой таблице."
                  : "Попробуйте изменить строку поиска или очистить фильтры."
              }
            />
          ) : (
            <TableScroll className="max-h-[70vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                      Pattern
                    </th>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                      Продукт
                    </th>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                      Тип
                    </th>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                      Создан
                    </th>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                      Обновлён
                    </th>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-right font-semibold text-slate-600">
                      Действия
                    </th>
                  </tr>
                </THead>

                <TBody>
                  {filtered.map((item) => {
                    const productLabel = getProductLabel(item, products);

                    return (
                      <Tr
                        key={item.id}
                        className={cn(
                          testResult?.ok &&
                          testResult?.matched &&
                          testResult?.rule?.id === item.id &&
                          "bg-emerald-50"
                        )}
                      >
                        <Td className="text-slate-900">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium">{item.pattern}</div>

                            {testResult?.ok &&
                              testResult?.matched &&
                              testResult?.rule?.id === item.id && (
                                <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  Сработало в тесте
                                </span>
                              )}
                          </div>
                        </Td>

                        <Td className="text-slate-700">{productLabel || "—"}</Td>

                        <Td>
                          <span
                            className={cn(
                              "inline-flex rounded-md border px-2 py-1 text-xs font-medium",
                              getMatchTypeTone(item.match_type)
                            )}
                          >
                            {getMatchTypeLabel(item.match_type)}
                          </span>
                        </Td>

                        <Td className="text-slate-500">
                          {formatDate(item.created_at)}
                        </Td>

                        <Td className="text-slate-500">
                          {formatDate(item.updated_at)}
                        </Td>

                        <Td>
                          <div className="flex justify-end gap-2">
                            {canManage ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditModal(item)}
                                >
                                  Редактировать
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={deleteBusy}
                                  onClick={() => void handleDelete(item)}
                                >
                                  Удалить
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Только просмотр
                              </span>
                            )}
                          </div>
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

      {createOpen && (
        <div className="fixed inset-0 z-[9990]">
          <button
            type="button"
            aria-label="Закрыть окно"
            onClick={closeCreateModal}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          <div className="absolute left-1/2 top-1/2 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Правило сопоставления
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  Добавить правило сопоставления
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Это правило будет использоваться при нормализации названий ПО.
                </div>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={createBusy}
                className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <FieldLabel>Pattern</FieldLabel>
                <TextInput
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  placeholder="Например: jetbrains"
                />
              </div>

              <div>
                <FieldLabel>Каноническое название продукта</FieldLabel>
                <TextInput
                  value={newCanonicalProduct}
                  onChange={(e) => setNewCanonicalProduct(e.target.value)}
                  placeholder="Например: JetBrains"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Тип сопоставления</FieldLabel>
                  <SelectDropdownButton
                    refProp={createMatchTypeAnchorRef}
                    onClick={() => setCreateMatchTypeOpen((v) => !v)}
                  >
                    {getMatchTypeSelectLabel(newMatchType)}
                  </SelectDropdownButton>

                  <Dropdown
                    open={createMatchTypeOpen}
                    onClose={() => setCreateMatchTypeOpen(false)}
                    anchorRef={createMatchTypeAnchorRef}
                    width={Math.max(createMatchTypeAnchorRef.current?.offsetWidth ?? 220, 220)}
                    align="start"
                    className="p-1"
                  >
                    <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {[
                        { value: "contains", label: "Содержит" },
                        { value: "exact", label: "Точно" },
                        { value: "regex", label: "Regex" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setNewMatchType(option.value);
                            setCreateMatchTypeOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                            newMatchType === option.value
                              ? "bg-slate-100 text-slate-950"
                              : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </Dropdown>
                </div>

                <div>
                  <FieldLabel>Продукт из справочника</FieldLabel>
                  <SelectDropdownButton
                    refProp={createProductAnchorRef}
                    onClick={() => setCreateProductDropdownOpen((v) => !v)}
                  >
                    {getProductSelectLabel(products, newProductId)}
                  </SelectDropdownButton>

                  <Dropdown
                    open={createProductDropdownOpen}
                    onClose={() => setCreateProductDropdownOpen(false)}
                    anchorRef={createProductAnchorRef}
                    width={Math.max(createProductAnchorRef.current?.offsetWidth ?? 320, 320)}
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

                      {products.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleCreateProductSelect(String(product.id))}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                            newProductId === String(product.id)
                              ? "bg-slate-100 text-slate-950"
                              : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <span className="truncate">
                            {product.name}
                            {product.vendor ? ` — ${product.vendor}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Dropdown>
                </div>
              </div>

              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {createError}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" disabled={createBusy} onClick={closeCreateModal}>
                Отмена
              </Button>

              <Button size="sm" disabled={createBusy} onClick={() => void handleCreateRule()}>
                {createBusy ? "Создание..." : "Создать правило"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editOpen && editingRule && (
        <div className="fixed inset-0 z-[9990]">
          <button
            type="button"
            aria-label="Закрыть окно"
            onClick={closeEditModal}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          <div className="absolute left-1/2 top-1/2 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Правило сопоставления
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-950">
                  Редактировать правило
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  Обновите параметры правила нормализации.
                </div>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={editBusy}
                className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <div>
                <FieldLabel>Pattern</FieldLabel>
                <TextInput
                  value={editPattern}
                  onChange={(e) => setEditPattern(e.target.value)}
                  placeholder="Например: jetbrains"
                />
              </div>

              <div>
                <FieldLabel>Каноническое название продукта</FieldLabel>
                <TextInput
                  value={editCanonicalProduct}
                  onChange={(e) => setEditCanonicalProduct(e.target.value)}
                  placeholder="Например: JetBrains"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Тип сопоставления</FieldLabel>
                  <SelectDropdownButton
                    refProp={editMatchTypeAnchorRef}
                    onClick={() => setEditMatchTypeOpen((v) => !v)}
                  >
                    {getMatchTypeSelectLabel(editMatchType)}
                  </SelectDropdownButton>

                  <Dropdown
                    open={editMatchTypeOpen}
                    onClose={() => setEditMatchTypeOpen(false)}
                    anchorRef={editMatchTypeAnchorRef}
                    width={Math.max(editMatchTypeAnchorRef.current?.offsetWidth ?? 220, 220)}
                    align="start"
                    className="p-1"
                  >
                    <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {[
                        { value: "contains", label: "Содержит" },
                        { value: "exact", label: "Точно" },
                        { value: "regex", label: "Regex" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setEditMatchType(option.value);
                            setEditMatchTypeOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                            editMatchType === option.value
                              ? "bg-slate-100 text-slate-950"
                              : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </Dropdown>
                </div>

                <div>
                  <FieldLabel>Продукт из справочника</FieldLabel>
                  <SelectDropdownButton
                    refProp={editProductAnchorRef}
                    onClick={() => setEditProductDropdownOpen((v) => !v)}
                  >
                    {getProductSelectLabel(products, editProductId)}
                  </SelectDropdownButton>

                  <Dropdown
                    open={editProductDropdownOpen}
                    onClose={() => setEditProductDropdownOpen(false)}
                    anchorRef={editProductAnchorRef}
                    width={Math.max(editProductAnchorRef.current?.offsetWidth ?? 320, 320)}
                    align="start"
                    className="p-1"
                  >
                    <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => handleEditProductSelect("")}
                        className={cn(
                          "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                          !editProductId
                            ? "bg-slate-100 text-slate-950"
                            : "text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        Не выбран
                      </button>

                      {products.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleEditProductSelect(String(product.id))}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                            editProductId === String(product.id)
                              ? "bg-slate-100 text-slate-950"
                              : "text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <span className="truncate">
                            {product.name}
                            {product.vendor ? ` — ${product.vendor}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </Dropdown>
                </div>
              </div>

              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {editError}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" disabled={editBusy} onClick={closeEditModal}>
                Отмена
              </Button>

              <Button size="sm" disabled={editBusy} onClick={() => void handleUpdateRule()}>
                {editBusy ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dropdown
        open={productFilterOpen}
        onClose={() => setProductFilterOpen(false)}
        anchorRef={productFilterAnchorRef}
        width={Math.max(productFilterAnchorRef.current?.offsetWidth ?? 320, 320)}
        align="start"
        className="p-1"
      >
        <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setSelectedProductFilter("");
              setProductFilterOpen(false);
            }}
            className={cn(
              "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
              !selectedProductFilter
                ? "bg-slate-100 text-slate-950"
                : "text-slate-700 hover:bg-slate-50"
            )}
          >
            Все продукты
          </button>

          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                setSelectedProductFilter(String(product.id));
                setProductFilterOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                selectedProductFilter === String(product.id)
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              <span className="truncate">
                {product.name}
                {product.vendor ? ` — ${product.vendor}` : ""}
              </span>
            </button>
          ))}
        </div>
      </Dropdown>

      <Dropdown
        open={matchTypeFilterOpen}
        onClose={() => setMatchTypeFilterOpen(false)}
        anchorRef={matchTypeFilterAnchorRef}
        width={Math.max(matchTypeFilterAnchorRef.current?.offsetWidth ?? 220, 220)}
        align="start"
        className="p-1"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {[
            { value: "", label: "Все типы" },
            { value: "contains", label: "Содержит" },
            { value: "exact", label: "Точно" },
            { value: "regex", label: "Regex" },
          ].map((option) => (
            <button
              key={option.value || "all"}
              type="button"
              onClick={() => {
                setSelectedMatchTypeFilter(option.value);
                setMatchTypeFilterOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                selectedMatchTypeFilter === option.value
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Dropdown>

      <Dropdown
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        anchorRef={sortAnchorRef}
        width={Math.max(sortAnchorRef.current?.offsetWidth ?? 260, 260)}
        align="start"
        className="p-1"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {[
            { value: "updated_desc", label: "Сначала обновлённые" },
            { value: "updated_asc", label: "Сначала старые обновления" },
            { value: "created_desc", label: "Сначала новые" },
            { value: "created_asc", label: "Сначала старые" },
            { value: "pattern_asc", label: "Pattern A → Z" },
            { value: "pattern_desc", label: "Pattern Z → A" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setSortBy(option.value as typeof sortBy);
                setSortOpen(false);
              }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition",
                sortBy === option.value
                  ? "bg-slate-100 text-slate-950"
                  : "text-slate-700 hover:bg-slate-50"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Dropdown>

      <ConfirmDialog
        open={confirmDelete.open}
        title={confirmDelete.cfg.title}
        description={confirmDelete.cfg.description}
        confirmLabel={confirmDelete.cfg.confirmLabel}
        cancelLabel={confirmDelete.cfg.cancelLabel}
        danger={confirmDelete.cfg.danger}
        requireText={confirmDelete.cfg.requireText}
        value={confirmDelete.value}
        onValueChange={confirmDelete.setValue}
        busy={deleteBusy}
        onCancel={confirmDelete.cancel}
        onConfirm={confirmDelete.confirm}
      />
    </div>
  );
}