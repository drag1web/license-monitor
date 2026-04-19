import { useEffect, useMemo, useRef, useState } from "react";
import {
    GitBranch,
    Search,
    Plus,
    Filter,
    ShieldCheck,
    RefreshCw,
    AlertTriangle,
    Unplug,
} from "lucide-react";

import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAuth } from "../auth/AuthContext";
import { ConfirmDialog } from "../ui/modal/ConfirmDialog";
import { useConfirmDialog } from "../ui/modal/useConfirmDialog";
import { ChevronDown } from "lucide-react";
import { Dropdown } from "../components/Dropdown";
import { useToast } from "../ui/toast";
import { cn } from "../ui/cn/cn";
import {
    getMappingRules,
    getProducts,
    createMappingRule,
    updateMappingRule,
    deleteMappingRule,
    type MappingRuleRow,
    type ProductRow,
} from "../api";

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

    if (v === "exact") return "Exact";
    if (v === "contains") return "Contains";
    if (v === "regex") return "Regex";

    return v || "—";
}

function getMatchTypeTone(value?: string | null) {
    const v = (value ?? "").trim().toLowerCase();

    if (v === "exact") {
        return "border-emerald-300/15 bg-emerald-300/10 text-emerald-100/90";
    }

    if (v === "contains") {
        return "border-cyan-300/15 bg-cyan-300/10 text-cyan-100/90";
    }

    if (v === "regex") {
        return "border-violet-300/15 bg-violet-300/10 text-violet-100/90";
    }

    return "border-white/[0.08] bg-white/[0.03] text-white/60";
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
    if (value === "exact") return "Exact";
    if (value === "contains") return "Contains";
    if (value === "regex") return "Regex";
    return value;
}

function getMatchTypeSelectLabel(value: string) {
    if (value === "exact") return "Exact";
    if (value === "contains") return "Contains";
    if (value === "regex") return "Regex";
    return "Contains";
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

export default function DictionariesMapping() {
    const { user } = useAuth();
    const { push } = useToast();
    const canManage = user?.role === "admin";

    const [items, setItems] = useState<MappingRuleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [ruleToDelete, setRuleToDelete] = useState<MappingRuleRow | null>(null);

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
    const [sortBy, setSortBy] = useState<"updated_desc" | "updated_asc" | "created_desc" | "created_asc" | "pattern_asc" | "pattern_desc">("updated_desc");
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

    const [products, setProducts] = useState<ProductRow[]>([]);

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
        setRuleToDelete(rule);

        const ok = await confirmDelete.ask({
            title: "Удалить правило сопоставления?",
            description: `Правило "${rule.pattern}"${getProductLabel(rule, products) ? ` для продукта "${getProductLabel(rule, products)}"` : ""} будет удалено без возможности быстрого восстановления.`,
            confirmLabel: "Удалить",
            cancelLabel: "Отмена",
            danger: true,
        });

        if (!ok) {
            setRuleToDelete(null);
            return;
        }

        setDeleteBusy(true);

        try {
            await deleteMappingRule(rule.id);
            await load();

            push({
                tone: "success",
                title: "Правило удалено",
                message: `Правило "${rule.pattern}" успешно удалено.`,
            });
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Не удалось удалить правило сопоставления"
            );
        } finally {
            setDeleteBusy(false);
            setRuleToDelete(null);
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
        if (selected) {
            setNewCanonicalProduct(selected.name);
        }
    }

    function handleEditProductSelect(productId: string) {
        setEditProductId(productId);
        setEditProductDropdownOpen(false);

        const selected = getSelectedProductById(products, productId);
        if (selected) {
            setEditCanonicalProduct(selected.name);
        }
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
            setCreateError("Укажи pattern.");
            return;
        }

        if (!canonicalProduct) {
            setCreateError("Укажи каноническое название продукта.");
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
            await load();

            push({
                tone: "success",
                title: "Правило создано",
                message: `Добавлено новое правило "${pattern}".`,
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
            setEditError("Укажи pattern.");
            return;
        }

        if (!canonicalProduct) {
            setEditError("Укажи каноническое название продукта.");
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

            push({
                tone: "success",
                title: "Изменения сохранены",
                message: `Правило "${pattern}" успешно обновлено.`,
            });
        } catch (e) {
            setEditError(
                e instanceof Error ? e.message : "Не удалось обновить правило сопоставления"
            );
        } finally {
            setEditBusy(false);
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        let rows = items.filter((item) => {
            const productLabel = getProductLabel(item, products);

            const haystack = [
                item.pattern,
                item.match_type ?? "",
                productLabel,
            ]
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
    }, [items]);

    const hasActiveFilters = Boolean(
        query.trim() || selectedProductFilter || selectedMatchTypeFilter || sortBy !== "updated_desc"
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
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
                <Card
                    className={cn(
                        "rounded-[24px] border border-white/[0.08] bg-white/[0.03]",
                        "p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-2.5 text-cyan-100/90">
                            <GitBranch className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-sm text-white/55">Правила</div>
                            <div className="text-xl font-semibold text-white/92">
                                {loading ? "…" : items.length}
                            </div>
                        </div>
                    </div>
                </Card>

                <Card
                    className={cn(
                        "rounded-[24px] border border-white/[0.08] bg-white/[0.03]",
                        "p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-violet-300/15 bg-violet-300/10 p-2.5 text-violet-100/90">
                            <Filter className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-sm text-white/55">Типы сопоставления</div>
                            <div className="text-xl font-semibold text-white/92">
                                {loading ? "…" : matchTypesCount}
                            </div>
                        </div>
                    </div>
                </Card>

                <Card
                    className={cn(
                        "rounded-[24px] border border-white/[0.08] bg-white/[0.03]",
                        "p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-2.5 text-emerald-100/90">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-sm text-white/55">Связанные продукты</div>
                            <div className="text-xl font-semibold text-white/92">
                                {loading ? "…" : linkedProductsCount}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <Card
                className={cn(
                    "rounded-[28px] border border-white/[0.08]",
                    "bg-gradient-to-b from-slate-950/72 via-slate-950/48 to-slate-950/28",
                    "backdrop-blur-xl shadow-[0_24px_90px_rgba(0,0,0,0.40)]"
                )}
            >
                <div className="p-5 md:p-6">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                                <Search className="h-4 w-4 text-white/45" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Поиск по pattern, продукту или типу сопоставления"
                                    className="w-full bg-transparent text-sm text-white/80 outline-none placeholder:text-white/35"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => void load()}
                                    className="inline-flex items-center gap-2"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    <span>Обновить</span>
                                </Button>

                                {canManage && (
                                    <Button
                                        className="inline-flex items-center gap-2"
                                        onClick={openCreateModal}
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>Добавить правило</span>
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                ref={productFilterAnchorRef}
                                type="button"
                                onClick={() => setProductFilterOpen((v) => !v)}
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                                    "border-white/[0.08] bg-white/[0.03] text-white/78",
                                    "hover:bg-white/[0.05] hover:text-white"
                                )}
                            >
                                <span className="truncate max-w-[240px]">
                                    {getFilterProductLabel(products, selectedProductFilter)}
                                </span>
                                <ChevronDown className="h-4 w-4 text-white/45" />
                            </button>

                            <button
                                ref={matchTypeFilterAnchorRef}
                                type="button"
                                onClick={() => setMatchTypeFilterOpen((v) => !v)}
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                                    "border-white/[0.08] bg-white/[0.03] text-white/78",
                                    "hover:bg-white/[0.05] hover:text-white"
                                )}
                            >
                                <span>{getFilterMatchTypeLabel(selectedMatchTypeFilter)}</span>
                                <ChevronDown className="h-4 w-4 text-white/45" />
                            </button>

                            <button
                                ref={sortAnchorRef}
                                type="button"
                                onClick={() => setSortOpen((v) => !v)}
                                className={cn(
                                    "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition",
                                    "border-white/[0.08] bg-white/[0.03] text-white/78",
                                    "hover:bg-white/[0.05] hover:text-white"
                                )}
                            >
                                <span>{getSortLabel(sortBy)}</span>
                                <ChevronDown className="h-4 w-4 text-white/45" />
                            </button>

                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetFilters}
                                >
                                    Сбросить
                                </Button>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div>{error}</div>
                        </div>
                    )}

                    <div className="mt-5 overflow-hidden rounded-[24px] border border-white/[0.08]">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-white/[0.04] text-white/55">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium">Pattern</th>
                                        <th className="px-4 py-3 text-left font-medium">Продукт</th>
                                        <th className="px-4 py-3 text-left font-medium">Match type</th>
                                        <th className="px-4 py-3 text-left font-medium">Создан</th>
                                        <th className="px-4 py-3 text-left font-medium">Обновлён</th>
                                        <th className="px-4 py-3 text-right font-medium">Действия</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {loading ? (
                                        Array.from({ length: 6 }).map((_, idx) => (
                                            <tr key={idx} className="border-t border-white/[0.06]">
                                                <td className="px-4 py-4">
                                                    <div className="h-4 w-48 animate-pulse rounded bg-white/[0.06]" />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="h-4 w-36 animate-pulse rounded bg-white/[0.06]" />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="h-7 w-24 animate-pulse rounded-2xl bg-white/[0.06]" />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="ml-auto h-8 w-24 animate-pulse rounded-xl bg-white/[0.06]" />
                                                </td>
                                            </tr>
                                        ))
                                    ) : filtered.length === 0 ? (
                                        <tr className="border-t border-white/[0.06]">
                                            <td colSpan={6} className="px-4 py-12">
                                                <div className="flex flex-col items-center justify-center gap-3 text-center">
                                                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 text-white/55">
                                                        <Unplug className="h-6 w-6" />
                                                    </div>

                                                    <div>
                                                        <div className="text-sm font-medium text-white/80">
                                                            {items.length === 0
                                                                ? "Правила сопоставления пока не добавлены"
                                                                : "Ничего не найдено по текущему запросу"}
                                                        </div>
                                                        <div className="mt-1 text-sm text-white/45">
                                                            {items.length === 0
                                                                ? "После добавления правил они появятся в этой таблице."
                                                                : "Попробуй изменить строку поиска или очистить фильтр."}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((item) => {
                                            const productLabel = getProductLabel(item, products);

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="border-t border-white/[0.06] transition hover:bg-white/[0.03]"
                                                >
                                                    <td className="px-4 py-3.5 text-white/88">
                                                        <div className="font-medium">{item.pattern}</div>
                                                    </td>

                                                    <td className="px-4 py-3.5 text-white/65">
                                                        {productLabel || "—"}
                                                    </td>

                                                    <td className="px-4 py-3.5">
                                                        <span
                                                            className={cn(
                                                                "inline-flex items-center rounded-2xl border px-2.5 py-1 text-xs font-semibold",
                                                                getMatchTypeTone(item.match_type)
                                                            )}
                                                        >
                                                            {getMatchTypeLabel(item.match_type)}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-3.5 text-white/55">
                                                        {formatDate(item.created_at)}
                                                    </td>

                                                    <td className="px-4 py-3.5 text-white/55">
                                                        {formatDate(item.updated_at)}
                                                    </td>

                                                    <td className="px-4 py-3.5">
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
                                                                <span className="text-xs text-white/35">Только просмотр</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </Card>
            {createOpen && (
                <div className="fixed inset-0 z-[9990]">
                    <button
                        type="button"
                        aria-label="Close modal"
                        onClick={closeCreateModal}
                        className="absolute inset-0 bg-black/60 bg-[radial-gradient(1200px_600px_at_50%_20%,rgba(0,255,255,0.08),transparent_55%),radial-gradient(900px_500px_at_20%_80%,rgba(255,0,128,0.06),transparent_55%)] backdrop-blur-[2px]"
                    />

                    <div
                        className={cn(
                            "absolute left-1/2 top-1/2 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2",
                            "rounded-[28px] border border-white/10 bg-[rgb(var(--panel))]/98",
                            "shadow-[0_30px_90px_rgba(0,0,0,0.60)] p-5"
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[11px] text-white/55">Mapping rule</div>
                                <div className="mt-1 text-lg font-semibold text-white/90">
                                    Добавить правило сопоставления
                                </div>
                                <div className="mt-2 text-sm text-white/60">
                                    Это правило будет использоваться при нормализации названий ПО.
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={closeCreateModal}
                                disabled={createBusy}
                                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white/90 disabled:opacity-50"
                            >
                                Закрыть
                            </button>
                        </div>

                        <div className="mt-5 grid gap-4">
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
                                        <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />
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

                                <div>
                                    <div className="mb-2 text-xs font-medium text-white/55">
                                        Продукт из справочника (опционально)
                                    </div>

                                    <button
                                        ref={editProductAnchorRef}
                                        type="button"
                                        onClick={() => setEditProductDropdownOpen((v) => !v)}
                                        className={cn(
                                            "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25",
                                            "px-3 py-2.5 text-sm text-white/85 outline-none transition",
                                            "hover:border-white/15 hover:bg-black/30",
                                            "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                                        )}
                                    >
                                        <span className="truncate text-left">
                                            {getProductSelectLabel(products, editProductId)}
                                        </span>
                                        <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />
                                    </button>

                                    <Dropdown
                                        open={editProductDropdownOpen}
                                        onClose={() => setEditProductDropdownOpen(false)}
                                        anchorRef={editProductAnchorRef}
                                        width={Math.max(editProductAnchorRef.current?.offsetWidth ?? 320, 320)}
                                        align="start"
                                        className="p-1"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleEditProductSelect("")}
                                            className={cn(
                                                "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition",
                                                !editProductId
                                                    ? "bg-cyan-300/14 text-cyan-100"
                                                    : "text-white/78 hover:bg-white/[0.05] hover:text-white"
                                            )}
                                        >
                                            Не выбран
                                        </button>

                                        {products.map((product) => {
                                            const active = editProductId === String(product.id);

                                            return (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    onClick={() => handleEditProductSelect(String(product.id))}
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

                            {createError && (
                                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
                                    {createError}
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={createBusy}
                                onClick={closeCreateModal}
                            >
                                Отмена
                            </Button>

                            <Button
                                size="sm"
                                disabled={createBusy}
                                onClick={() => void handleCreateRule()}
                            >
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
                        aria-label="Close modal"
                        onClick={closeEditModal}
                        className="absolute inset-0 bg-black/60 bg-[radial-gradient(1200px_600px_at_50%_20%,rgba(0,255,255,0.08),transparent_55%),radial-gradient(900px_500px_at_20%_80%,rgba(255,0,128,0.06),transparent_55%)] backdrop-blur-[2px]"
                    />

                    <div
                        className={cn(
                            "absolute left-1/2 top-1/2 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2",
                            "rounded-[28px] border border-white/10 bg-[rgb(var(--panel))]/98",
                            "shadow-[0_30px_90px_rgba(0,0,0,0.60)] p-5"
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[11px] text-white/55">Mapping rule</div>
                                <div className="mt-1 text-lg font-semibold text-white/90">
                                    Редактировать правило сопоставления
                                </div>
                                <div className="mt-2 text-sm text-white/60">
                                    Обнови параметры правила нормализации для выбранного продукта.
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={closeEditModal}
                                disabled={editBusy}
                                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] hover:text-white/90 disabled:opacity-50"
                            >
                                Закрыть
                            </button>
                        </div>

                        <div className="mt-5 grid gap-4">
                            <div>
                                <div className="mb-2 text-xs font-medium text-white/55">Pattern</div>
                                <input
                                    value={editPattern}
                                    onChange={(e) => setEditPattern(e.target.value)}
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
                                    value={editCanonicalProduct}
                                    onChange={(e) => setEditCanonicalProduct(e.target.value)}
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
                                        ref={editMatchTypeAnchorRef}
                                        type="button"
                                        onClick={() => setEditMatchTypeOpen((v) => !v)}
                                        className={cn(
                                            "flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25",
                                            "px-3 py-2.5 text-sm text-white/85 outline-none transition",
                                            "hover:border-white/15 hover:bg-black/30",
                                            "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                                        )}
                                    >
                                        <span>{getMatchTypeSelectLabel(editMatchType)}</span>
                                        <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />
                                    </button>

                                    <Dropdown
                                        open={editMatchTypeOpen}
                                        onClose={() => setEditMatchTypeOpen(false)}
                                        anchorRef={editMatchTypeAnchorRef}
                                        width={Math.max(editMatchTypeAnchorRef.current?.offsetWidth ?? 220, 220)}
                                        align="start"
                                        className="p-1"
                                    >
                                        {[
                                            { value: "contains", label: "Contains" },
                                            { value: "exact", label: "Exact" },
                                            { value: "regex", label: "Regex" },
                                        ].map((option) => {
                                            const active = editMatchType === option.value;

                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setEditMatchType(option.value);
                                                        setEditMatchTypeOpen(false);
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
                                        Product ID (опционально)
                                    </div>
                                    <input
                                        value={editProductId}
                                        onChange={(e) => setEditProductId(e.target.value)}
                                        placeholder="Например: 3"
                                        inputMode="numeric"
                                        className={cn(
                                            "w-full rounded-2xl border border-white/10 bg-black/25",
                                            "px-3 py-2.5 text-sm text-white/85 outline-none",
                                            "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                                        )}
                                    />
                                </div>
                            </div>

                            {editError && (
                                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
                                    {editError}
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={editBusy}
                                onClick={closeEditModal}
                            >
                                Отмена
                            </Button>

                            <Button
                                size="sm"
                                disabled={editBusy}
                                onClick={() => void handleUpdateRule()}
                            >
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
                <button
                    type="button"
                    onClick={() => {
                        setSelectedProductFilter("");
                        setProductFilterOpen(false);
                    }}
                    className={cn(
                        "flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition",
                        !selectedProductFilter
                            ? "bg-cyan-300/14 text-cyan-100"
                            : "text-white/78 hover:bg-white/[0.05] hover:text-white"
                    )}
                >
                    Все продукты
                </button>

                {products.map((product) => {
                    const active = selectedProductFilter === String(product.id);

                    return (
                        <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                                setSelectedProductFilter(String(product.id));
                                setProductFilterOpen(false);
                            }}
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
            <Dropdown
                open={matchTypeFilterOpen}
                onClose={() => setMatchTypeFilterOpen(false)}
                anchorRef={matchTypeFilterAnchorRef}
                width={Math.max(matchTypeFilterAnchorRef.current?.offsetWidth ?? 220, 220)}
                align="start"
                className="p-1"
            >
                {[
                    { value: "", label: "Все типы" },
                    { value: "contains", label: "Contains" },
                    { value: "exact", label: "Exact" },
                    { value: "regex", label: "Regex" },
                ].map((option) => {
                    const active = selectedMatchTypeFilter === option.value;

                    return (
                        <button
                            key={option.value || "all"}
                            type="button"
                            onClick={() => {
                                setSelectedMatchTypeFilter(option.value);
                                setMatchTypeFilterOpen(false);
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
            <Dropdown
                open={sortOpen}
                onClose={() => setSortOpen(false)}
                anchorRef={sortAnchorRef}
                width={Math.max(sortAnchorRef.current?.offsetWidth ?? 260, 260)}
                align="start"
                className="p-1"
            >
                {[
                    { value: "updated_desc", label: "Сначала обновлённые" },
                    { value: "updated_asc", label: "Сначала старые обновления" },
                    { value: "created_desc", label: "Сначала новые" },
                    { value: "created_asc", label: "Сначала старые" },
                    { value: "pattern_asc", label: "Pattern A → Z" },
                    { value: "pattern_desc", label: "Pattern Z → A" },
                ].map((option) => {
                    const active = sortBy === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                setSortBy(option.value as typeof sortBy);
                                setSortOpen(false);
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
                panelClassName="bg-[rgb(var(--panel))]/98"
            />
        </div>
    );
}