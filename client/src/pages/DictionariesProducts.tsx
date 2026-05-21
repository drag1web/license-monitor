import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Boxes,
  Search,
  Plus,
  Building2,
  Tags,
  RefreshCw,
  AlertTriangle,
  X,
  Play,
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
  runCheck,
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-medium text-slate-500">{children}</div>;
}

function ProductModal({
  title,
  description,
  busy,
  error,
  name,
  vendor,
  category,
  onName,
  onVendor,
  onCategory,
  onClose,
  onSubmit,
  submitLabel,
}: {
  title: string;
  description: string;
  busy: boolean;
  error: string;
  name: string;
  vendor: string;
  category: string;
  onName: (v: string) => void;
  onVendor: (v: string) => void;
  onCategory: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="fixed inset-0 z-[9990]">
      <button
        type="button"
        aria-label="Закрыть окно"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      />

      <div
        className={cn(
          "absolute left-1/2 top-1/2 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2",
          "rounded-2xl border border-slate-300 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.24)]"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Справочник продуктов
            </div>

            <div className="mt-1 text-lg font-semibold text-slate-950">
              {title}
            </div>

            <div className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <FieldLabel>Название</FieldLabel>
            <TextInput
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="Например: JetBrains IntelliJ IDEA"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Вендор</FieldLabel>
              <TextInput
                value={vendor}
                onChange={(e) => onVendor(e.target.value)}
                placeholder="Например: JetBrains"
              />
            </div>

            <div>
              <FieldLabel>Категория</FieldLabel>
              <TextInput
                value={category}
                onChange={(e) => onCategory(e.target.value)}
                placeholder="Например: IDE"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
            Отмена
          </Button>

          <Button size="sm" disabled={busy} onClick={onSubmit}>
            {busy ? "Сохранение..." : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DictionariesProducts() {
  const { user } = useAuth();
  const { push } = useToast();
  const canManage = user?.role === "admin";

  const navigate = useNavigate();

  const [productsChanged, setProductsChanged] = useState(false);
  const [runBusy, setRunBusy] = useState(false);

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

  async function runCheckAndOpen() {
    if (!canManage) return;

    setRunBusy(true);
    setError("");

    try {
      const out = await runCheck();

      if (!out.ok) {
        throw new Error(out.error || "Не удалось запустить проверку");
      }

      setProductsChanged(false);
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
      setCreateError("Укажите название продукта.");
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
      setProductsChanged(true);

      push({
        tone: "success",
        title: "Продукт создан",
        message: `Добавлен продукт "${name}". Для применения в результатах запустите проверку.`,
        action: {
          label: "Запустить",
          onClick: () => void runCheckAndOpen(),
        },
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
      setEditError("Укажите название продукта.");
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
      setProductsChanged(true);

      push({
        tone: "success",
        title: "Изменения сохранены",
        message: `Продукт "${name}" обновлён. Для применения изменений запустите проверку.`,
        action: {
          label: "Запустить",
          onClick: () => void runCheckAndOpen(),
        },
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
      setProductsChanged(true);

      push({
        tone: "success",
        title: "Продукт удалён",
        message: `Продукт "${product.name}" удалён. Для обновления результатов запустите проверку.`,
        action: {
          label: "Запустить",
          onClick: () => void runCheckAndOpen(),
        },
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <MiniStat
          label="Продукты"
          value={loading ? 0 : items.length}
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

      {canManage && productsChanged && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-amber-900">
                Справочник продуктов изменён
              </div>

              <div className="mt-1 text-xs text-amber-700">
                Продукты используются в правилах сопоставления и результатах мониторинга.
                Чтобы изменения отразились в новых расчётах, запустите проверку.
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
                onClick={() => setProductsChanged(false)}
              >
                Скрыть
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Search className="h-4 w-4" />
            <div className="text-sm font-semibold">Поиск и действия</div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-slate-100">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию, вендору или категории..."
                className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => void load()}
                className="inline-flex items-center gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
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

          <div className="text-xs text-slate-500">
            Показано:{" "}
            <span className="font-semibold text-slate-900">{filtered.length}</span>{" "}
            из <span className="font-semibold text-slate-900">{items.length}</span>
          </div>
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
            title="Справочник продуктов"
            description="Канонические продукты, используемые в правилах сопоставления и расчёте лицензий."
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
                  ? "Справочник продуктов пока пуст"
                  : "Ничего не найдено"
              }
              description={
                items.length === 0
                  ? "После добавления продуктов они появятся в этой таблице."
                  : "Попробуйте изменить строку поиска."
              }
            />
          ) : (
            <TableScroll className="max-h-[70vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                      Название
                    </th>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                      Вендор
                    </th>
                    <th className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">
                      Категория
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
                  {filtered.map((item) => (
                    <Tr key={item.id}>
                      <Td className="font-semibold text-slate-900">
                        {item.name}
                      </Td>

                      <Td className="text-slate-700">{item.vendor || "—"}</Td>

                      <Td className="text-slate-700">{item.category || "—"}</Td>

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
                                onClick={() => void handleDeleteProduct(item)}
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
                  ))}
                </TBody>
              </TableInner>
            </TableScroll>
          )}
        </Table>
      </Card>

      {createOpen && (
        <ProductModal
          title="Добавить продукт"
          description="Новый продукт появится в справочнике и сможет использоваться в правилах сопоставления."
          busy={createBusy}
          error={createError}
          name={newName}
          vendor={newVendor}
          category={newCategory}
          onName={setNewName}
          onVendor={setNewVendor}
          onCategory={setNewCategory}
          onClose={closeCreateModal}
          onSubmit={() => void handleCreateProduct()}
          submitLabel="Создать продукт"
        />
      )}

      {editOpen && editingProduct && (
        <ProductModal
          title="Редактировать продукт"
          description="Обновите свойства продукта в справочнике."
          busy={editBusy}
          error={editError}
          name={editName}
          vendor={editVendor}
          category={editCategory}
          onName={setEditName}
          onVendor={setEditVendor}
          onCategory={setEditCategory}
          onClose={closeEditModal}
          onSubmit={() => void handleUpdateProduct()}
          submitLabel="Сохранить изменения"
        />
      )}
    </div>
  );
}