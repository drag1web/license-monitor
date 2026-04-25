import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Search,
  Plus,
  Building2,
  Tags,
  RefreshCw,
  AlertTriangle,
  PackageSearch,
} from "lucide-react";

import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/toast";
import { ConfirmDialog } from "../ui/modal/ConfirmDialog";
import { useConfirmDialog } from "../ui/modal/useConfirmDialog";
import { cn } from "../ui/cn/cn";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
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

function normalizeText(value?: string | null) {
  return (value ?? "").trim();
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
  icon?: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "warn"
      ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
      : tone === "bad"
      ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
      : "border-white/10 bg-white/[0.03] text-white/80";

  return (
    <div className={cn("rounded-2xl border px-4 py-3", cls)}>
      <div className="flex items-center gap-2 text-[11px] opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function DictionariesProducts() {
  const { user } = useAuth();
  const { push } = useToast();
  const canManage = user?.role === "admin";

  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  const [newName, setNewName] = useState("");
  const [newVendor, setNewVendor] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  const [editName, setEditName] = useState("");
  const [editVendor, setEditVendor] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const [deleteBusy, setDeleteBusy] = useState(false);
  const confirmDelete = useConfirmDialog();

  async function load() {
    setLoading(true);
    setError("");

    try {
      const rows = await getProducts();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить продукты");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreateModal() {
    setCreateError("");
    setNewName("");
    setNewVendor("");
    setNewCategory("");
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (createBusy) return;
    setCreateOpen(false);
  }

  function openEditModal(product: ProductRow) {
    setEditingProduct(product);
    setEditName(product.name ?? "");
    setEditVendor(product.vendor ?? "");
    setEditCategory(product.category ?? "");
    setEditError("");
    setEditOpen(true);
  }

  function closeEditModal() {
    if (editBusy) return;
    setEditOpen(false);
    setEditingProduct(null);
  }

  async function handleCreateProduct() {
    const name = newName.trim();
    const vendor = newVendor.trim();
    const category = newCategory.trim();

    if (!name) {
      setCreateError("Укажи название продукта.");
      return;
    }

    setCreateBusy(true);
    setCreateError("");

    try {
      await createProduct({
        name,
        vendor: vendor || undefined,
        category: category || undefined,
      });

      setCreateOpen(false);
      await load();

      push({
        tone: "success",
        title: "Продукт создан",
        message: `Добавлен продукт "${name}".`,
      });
    } catch (e) {
      setCreateError(
        e instanceof Error ? e.message : "Не удалось создать продукт"
      );
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleUpdateProduct() {
    if (!editingProduct) return;

    const name = editName.trim();
    const vendor = editVendor.trim();
    const category = editCategory.trim();

    if (!name) {
      setEditError("Укажи название продукта.");
      return;
    }

    setEditBusy(true);
    setEditError("");

    try {
      await updateProduct(editingProduct.id, {
        name,
        vendor: vendor || undefined,
        category: category || undefined,
      });

      setEditOpen(false);
      setEditingProduct(null);
      await load();

      push({
        tone: "success",
        title: "Изменения сохранены",
        message: `Продукт "${name}" успешно обновлён.`,
      });
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : "Не удалось обновить продукт"
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDeleteProduct(product: ProductRow) {
    const ok = await confirmDelete.ask({
      title: "Удалить продукт?",
      description: `Продукт "${product.name}" будет удалён. Если он используется в правилах сопоставления, сервер может отклонить удаление.`,
      confirmLabel: "Удалить",
      cancelLabel: "Отмена",
      danger: true,
    });

    if (!ok) return;

    setDeleteBusy(true);

    try {
      await deleteProduct(product.id);
      await load();

      push({
        tone: "success",
        title: "Продукт удалён",
        message: `Продукт "${product.name}" успешно удалён.`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить продукт");
    } finally {
      setDeleteBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const haystack = [item.name, item.vendor ?? "", item.category ?? ""]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, query]);

  const vendorsCount = useMemo(() => {
    return new Set(items.map((x) => normalizeText(x.vendor)).filter(Boolean)).size;
  }, [items]);

  const categoriesCount = useMemo(() => {
    return new Set(items.map((x) => normalizeText(x.category)).filter(Boolean)).size;
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MiniStat
          label="Продукты"
          value={loading ? 0 : items.length}
          tone="none"
          icon={<Boxes className="h-4 w-4" />}
        />
        <MiniStat
          label="Вендоры"
          value={loading ? 0 : vendorsCount}
          tone="ok"
          icon={<Building2 className="h-4 w-4" />}
        />
        <MiniStat
          label="Категории"
          value={loading ? 0 : categoriesCount}
          tone="warn"
          icon={<Tags className="h-4 w-4" />}
        />
      </div>

      <Card
        className={cn(
          "rounded-3xl p-4",
          "border border-white/[0.08]",
          "bg-white/[0.02]"
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-white/70">
            <Search className="h-4 w-4" />
            <div className="text-sm font-semibold">Поиск и действия</div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div
              className={cn(
                "flex items-center gap-2 rounded-2xl px-3.5 py-2",
                "bg-white/[0.03] border border-white/[0.08]",
                "focus-within:border-cyan-200/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.10)]"
              )}
            >
              <Search className="h-4 w-4 shrink-0 text-white/45" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию, вендору или категории…"
                className="w-full min-w-0 bg-transparent outline-none text-sm text-white/85 placeholder:text-white/35"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
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
                  <span>Добавить продукт</span>
                </Button>
              )}
            </div>
          </div>

          <div className="text-[12px] text-white/45">
            Показано:{" "}
            <span className="font-semibold text-white/70">{filtered.length}</span>{" "}
            из <span className="font-semibold text-white/70">{items.length}</span>
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      <Card className="p-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
        <Table>
          <TableCaption
            title="Справочник продуктов"
            description="Канонические продукты, используемые в правилах сопоставления и других частях системы."
            right={
              <div className="text-[11px] text-white/45">
                {loading ? "Загружаю…" : `Показано: ${filtered.length} / ${items.length}`}
              </div>
            }
          />

          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : filtered.length === 0 ? (
            <TableEmpty
              title={
                items.length === 0
                  ? "Справочник продуктов пока пуст"
                  : "Ничего не найдено"
              }
              description={
                items.length === 0
                  ? "После добавления продуктов они появятся в этой таблице."
                  : "Попробуй изменить строку поиска."
              }
            />
          ) : (
            <TableScroll className="max-h-[70vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-white/55">
                      Название
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-white/55">
                      Вендор
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-white/55">
                      Категория
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-white/55">
                      Создан
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-white/55">
                      Обновлён
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-white/55">
                      Действия
                    </th>
                  </tr>
                </THead>

                <TBody>
                  {filtered.map((item) => (
                    <Tr key={item.id}>
                      <Td className="font-semibold text-white/88">
                        {item.name}
                      </Td>

                      <Td className="text-white/65">{item.vendor || "—"}</Td>

                      <Td className="text-white/65">{item.category || "—"}</Td>

                      <Td className="text-white/55">
                        {formatDate(item.created_at)}
                      </Td>

                      <Td className="text-white/55">
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
                                onClick={() => void handleDeleteProduct(item)}
                              >
                                Удалить
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-white/35">
                              Только просмотр
                            </span>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
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
                <div className="text-[11px] text-white/55">Product</div>
                <div className="mt-1 text-lg font-semibold text-white/90">
                  Добавить продукт
                </div>
                <div className="mt-2 text-sm text-white/60">
                  Новый продукт появится в справочнике и сможет использоваться
                  в правилах сопоставления.
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
                <div className="mb-2 text-xs font-medium text-white/55">
                  Название
                </div>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Например: JetBrains IntelliJ IDEA"
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
                    Вендор
                  </div>
                  <input
                    value={newVendor}
                    onChange={(e) => setNewVendor(e.target.value)}
                    placeholder="Например: JetBrains"
                    className={cn(
                      "w-full rounded-2xl border border-white/10 bg-black/25",
                      "px-3 py-2.5 text-sm text-white/85 outline-none",
                      "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                    )}
                  />
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-white/55">
                    Категория
                  </div>
                  <input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Например: IDE"
                    className={cn(
                      "w-full rounded-2xl border border-white/10 bg-black/25",
                      "px-3 py-2.5 text-sm text-white/85 outline-none",
                      "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                    )}
                  />
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
                onClick={() => void handleCreateProduct()}
              >
                {createBusy ? "Создание..." : "Создать продукт"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editOpen && editingProduct && (
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
                <div className="text-[11px] text-white/55">Product</div>
                <div className="mt-1 text-lg font-semibold text-white/90">
                  Редактировать продукт
                </div>
                <div className="mt-2 text-sm text-white/60">
                  Обнови свойства продукта в справочнике.
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
                <div className="mb-2 text-xs font-medium text-white/55">
                  Название
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Например: JetBrains IntelliJ IDEA"
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
                    Вендор
                  </div>
                  <input
                    value={editVendor}
                    onChange={(e) => setEditVendor(e.target.value)}
                    placeholder="Например: JetBrains"
                    className={cn(
                      "w-full rounded-2xl border border-white/10 bg-black/25",
                      "px-3 py-2.5 text-sm text-white/85 outline-none",
                      "focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                    )}
                  />
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-white/55">
                    Категория
                  </div>
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="Например: IDE"
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
                onClick={() => void handleUpdateProduct()}
              >
                {editBusy ? "Сохранение..." : "Сохранить изменения"}
              </Button>
            </div>
          </div>
        </div>
      )}

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