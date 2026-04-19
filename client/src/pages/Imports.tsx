import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Database,
  Upload,
  Trash2,
  FolderInput,
} from "lucide-react";
import {
  getImports,
  uploadImport,
  runCheck,
  cleanupImportsKeepLast,
  type ImportRow,
} from "../api";
import { Card } from "../ui/Card";
import { Dropdown } from "../components/Dropdown";
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

type SortKey =
  | "id"
  | "import_type"
  | "file_name"
  | "rows_count"
  | "status"
  | "imported_at";

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

function statusTone(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "success") return "ok";
  if (s === "failed") return "bad";
  if (s === "partial") return "warn";
  return "none";
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);

  const cls =
    tone === "ok"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "warn"
      ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
      : tone === "bad"
      ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
      : "border-white/10 bg-white/[0.03] text-white/70";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-[12px] font-semibold",
        cls
      )}
    >
      {tone === "ok" ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : tone === "warn" ? (
        <AlertTriangle className="h-4 w-4" />
      ) : tone === "bad" ? (
        <XCircle className="h-4 w-4" />
      ) : (
        <Clock className="h-4 w-4" />
      )}
      {status || "unknown"}
    </span>
  );
}

function SoftButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
        "bg-white/[0.03] border border-white/[0.08] text-white/85",
        "hover:bg-white/[0.06] hover:border-white/[0.12]",
        "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "shadow-[0_12px_40px_rgba(0,0,0,0.28)]",
        props.className
      )}
    >
      {props.leftIcon}
      {props.children}
    </button>
  );
}

function getSortValue(row: ImportRow, key: SortKey) {
  return row[key];
}

function compareRows(
  a: ImportRow,
  b: ImportRow,
  key: SortKey,
  dir: Exclude<SortDir, null>
) {
  const mul = dir === "asc" ? 1 : -1;

  if (key === "id" || key === "rows_count") {
    return (safeNum(getSortValue(a, key)) - safeNum(getSortValue(b, key))) * mul;
  }

  if (key === "imported_at") {
    const at = Date.parse(String(a.imported_at));
    const bt = Date.parse(String(b.imported_at));
    return (at - bt) * mul;
  }

  return (
    String(getSortValue(a, key) ?? "").localeCompare(
      String(getSortValue(b, key) ?? "")
    ) * mul
  );
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

export default function Imports() {
  const [items, setItems] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "installations" | "licenses" | "mapping"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "success" | "partial" | "failed"
  >("all");

  const [uploadType, setUploadType] = useState<
    "installations" | "licenses" | "mapping"
  >("installations");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadAndRunBusy, setUploadAndRunBusy] = useState(false);

  const uploadTypeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [uploadTypeOpen, setUploadTypeOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [keepLast, setKeepLast] = useState(100);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  const filtersBtnRef = useRef<HTMLButtonElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>("imported_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  async function refresh() {
    setLoading(true);
    setErr("");

    try {
      const rows = await getImports();
      setItems(rows ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return items.filter((row) => {
      if (typeFilter !== "all" && row.import_type !== typeFilter) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;

      if (!needle) return true;

      const hay = [
        row.import_type,
        row.file_name ?? "",
        row.source_path ?? "",
        row.status,
        row.comment ?? "",
        row.imported_at,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });
  }, [items, q, typeFilter, statusFilter]);

  const sorted = useMemo(() => {
    if (!sortDir) return filtered;
    return [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey, defaultDir: Exclude<SortDir, null>) {
    setSortKey(key);
    setSortDir((d) => {
      if (sortKey !== key) return defaultDir;
      return nextDir(d);
    });
  }

  async function onCleanup() {
    if (!Number.isFinite(keepLast) || keepLast < 0) return;

    setCleanupBusy(true);
    setErr("");

    try {
      const out = await cleanupImportsKeepLast(keepLast);
      if (!out.ok) {
        throw new Error(out.error || "cleanup failed");
      }

      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCleanupBusy(false);
    }
  }

  async function onUpload(runAfter = false) {
    if (!uploadFile) return;

    if (runAfter) {
      setUploadAndRunBusy(true);
    } else {
      setUploading(true);
    }

    setErr("");

    try {
      const out = await uploadImport(uploadType, uploadFile);
      if (!out.ok) {
        throw new Error(out.error || "upload failed");
      }

      if (runAfter) {
        const runOut = await runCheck();
        if (!runOut.ok) {
          throw new Error(runOut.error || "run failed");
        }
      }

      setUploadFile(null);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      setUploadAndRunBusy(false);
    }
  }

  const stats = useMemo(() => {
    return {
      total: items.length,
      success: items.filter((x) => x.status === "success").length,
      partial: items.filter((x) => x.status === "partial").length,
      failed: items.filter((x) => x.status === "failed").length,
    };
  }, [items]);

  return (
    <div className="space-y-4">
      {!isAdmin && (
        <ViewerNotice
          className="mb-4"
          message="У вас нет прав на загрузку CSV, запуск проверки и очистку журнала импортов. Доступен только просмотр."
        />
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
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div
                className={cn(
                  "grid h-14 w-14 shrink-0 place-items-center rounded-3xl",
                  "bg-[rgba(var(--fg),0.04)]",
                  "shadow-[0_18px_60px_rgba(34,211,238,0.10)]"
                )}
              >
                <FolderInput className="h-7 w-7 text-cyan-300/90" />
              </div>

              <div className="min-w-0">
                <div className="text-xs tracking-wide text-white/46">История импортов</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight text-white/92">
                  Импорты
                </div>
                <div className="mt-2 max-w-[72ch] text-sm leading-relaxed text-white/58">
                  Журнал загрузки исходных CSV, ручной import из интерфейса и контроль
                  состояния входных данных для pipeline.
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusBadge status={stats.failed > 0 ? "failed" : stats.partial > 0 ? "partial" : "success"} />
                  <span className="inline-flex items-center gap-2 text-[12px] text-white/45">
                    <Database className="h-4 w-4" />
                    <span>Всего записей: {stats.total}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <SoftButton
                onClick={refresh}
                disabled={loading}
                leftIcon={<RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />}
              >
                Обновить
              </SoftButton>

              {isAdmin && (
                <>
                  <SoftButton
                    onClick={onCleanup}
                    disabled={cleanupBusy}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    {cleanupBusy ? "Очищаю..." : "Очистить старые"}
                  </SoftButton>
                </>
              )}
            </div>
          </div>

          {isAdmin && (
            <div
              className={cn(
                "rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4"
              )}
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-white/88">Ручная загрузка CSV</div>
                  <div className="text-sm text-white/50">
                    Загрузить новый файл installations, licenses или mapping.
                    При необходимости можно сразу запустить проверку.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[220px_minmax(0,1fr)_auto]">
                  <div className="relative">
                    <button
                      ref={uploadTypeBtnRef}
                      type="button"
                      onClick={() => setUploadTypeOpen((v) => !v)}
                      className={cn(
                        "inline-flex w-full items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold",
                        "bg-white/[0.03] border-white/[0.08] text-white/85",
                        "hover:bg-white/[0.06] hover:border-white/[0.12]",
                        "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                      )}
                    >
                      <span>{uploadType}</span>
                      <span className="text-white/40">▾</span>
                    </button>

                    <Dropdown
                      open={uploadTypeOpen}
                      onClose={() => setUploadTypeOpen(false)}
                      anchorRef={uploadTypeBtnRef as React.RefObject<HTMLElement>}
                      width={220}
                      align="start"
                      className="p-2"
                    >
                      <div className="space-y-1">
                        {(["installations", "licenses", "mapping"] as const).map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              setUploadType(item);
                              setUploadTypeOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition",
                              uploadType === item
                                ? "border border-cyan-400/18 bg-cyan-500/14 text-cyan-200"
                                : "text-white/75 hover:bg-white/[0.06]"
                            )}
                          >
                            <span>{item}</span>
                            {uploadType === item ? (
                              <span className="text-cyan-300/80">✓</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </Dropdown>
                  </div>

                  <label
                    className={cn(
                      "flex items-center rounded-2xl border px-3.5 py-2 text-sm",
                      "bg-white/[0.03] border-white/[0.08] text-white/75",
                      "cursor-pointer hover:bg-white/[0.06] hover:border-white/[0.12]"
                    )}
                  >
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setUploadFile(f);
                      }}
                    />
                    <span className="truncate">
                      {uploadFile ? uploadFile.name : "Выбрать CSV файл"}
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <SoftButton
                      onClick={() => onUpload(false)}
                      disabled={!uploadFile || uploading || uploadAndRunBusy}
                      leftIcon={<Upload className="h-4 w-4" />}
                    >
                      {uploading ? "Загружаю..." : "Загрузить"}
                    </SoftButton>

                    <SoftButton
                      onClick={() => onUpload(true)}
                      disabled={!uploadFile || uploading || uploadAndRunBusy}
                      leftIcon={
                        <RefreshCw className={cn("h-4 w-4", uploadAndRunBusy && "animate-spin")} />
                      }
                    >
                      {uploadAndRunBusy ? "Загрузка + запуск..." : "Загрузить и запустить"}
                    </SoftButton>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/45">
                  <span>Очистка журнала:</span>
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border px-3 py-1.5",
                      "bg-white/[0.03] border-white/[0.08]"
                    )}
                  >
                    <span>Оставить</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={keepLast}
                      onChange={(e) =>
                        setKeepLast(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-16 bg-transparent text-sm font-semibold text-white/85 outline-none"
                    />
                    <span>записей</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              label="Всего"
              value={stats.total}
              tone="none"
              icon={<Database className="h-4 w-4" />}
            />
            <MiniStat
              label="Success"
              value={stats.success}
              tone="ok"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <MiniStat
              label="Partial"
              value={stats.partial}
              tone="warn"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <MiniStat
              label="Failed"
              value={stats.failed}
              tone="bad"
              icon={<XCircle className="h-4 w-4" />}
            />
          </div>
        </div>
      </Card>

      <Card
        className={cn(
          "rounded-3xl p-4",
          "border border-white/[0.08]",
          "bg-white/[0.02]"
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-white/70">
            <Filter className="h-4 w-4" />
            <div className="text-sm font-semibold">Фильтры и поиск</div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
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
                placeholder="Поиск: file / path / status / comment…"
                className="w-full min-w-0 bg-transparent outline-none text-sm text-white/85 placeholder:text-white/35"
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                ref={filtersBtnRef}
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold",
                  "bg-white/[0.03] border-white/[0.08] text-white/85",
                  "hover:bg-white/[0.06] hover:border-white/[0.12]",
                  "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                )}
              >
                <Filter className="h-4 w-4" />
                Фильтры
                <span className="text-white/45">
                  {typeFilter !== "all" || statusFilter !== "all" ? "•" : ""}
                </span>
              </button>

              <Dropdown
                open={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                anchorRef={filtersBtnRef as React.RefObject<HTMLElement>}
                width={320}
                align="end"
                className="p-3"
              >
                <div className="space-y-3">
                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                      Тип импорта
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "all", label: "Все" },
                        { value: "installations", label: "Installations" },
                        { value: "licenses", label: "Licenses" },
                        { value: "mapping", label: "Mapping" },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() =>
                            setTypeFilter(
                              item.value as
                                | "all"
                                | "installations"
                                | "licenses"
                                | "mapping"
                            )
                          }
                          className={cn(
                            "rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                            typeFilter === item.value
                              ? "border-cyan-400/18 bg-cyan-500/14 text-cyan-200"
                              : "border-white/[0.08] bg-white/[0.03] text-white/75 hover:bg-white/[0.06]"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                      Статус
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "all", label: "Все" },
                        { value: "success", label: "Success" },
                        { value: "partial", label: "Partial" },
                        { value: "failed", label: "Failed" },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() =>
                            setStatusFilter(
                              item.value as "all" | "success" | "partial" | "failed"
                            )
                          }
                          className={cn(
                            "rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                            statusFilter === item.value
                              ? item.value === "failed"
                                ? "border-rose-400/18 bg-rose-500/14 text-rose-200"
                                : item.value === "partial"
                                ? "border-amber-400/18 bg-amber-500/14 text-amber-200"
                                : "border-cyan-400/18 bg-cyan-500/14 text-cyan-200"
                              : "border-white/[0.08] bg-white/[0.03] text-white/75 hover:bg-white/[0.06]"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setTypeFilter("all");
                        setStatusFilter("all");
                      }}
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                        "border-white/[0.08] bg-white/[0.03] text-white/75 hover:bg-white/[0.06]"
                      )}
                    >
                      Сбросить
                    </button>

                    <button
                      type="button"
                      onClick={() => setFiltersOpen(false)}
                      className={cn(
                        "rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                        "border-cyan-400/18 bg-cyan-500/14 text-cyan-200 hover:bg-cyan-500/20"
                      )}
                    >
                      Готово
                    </button>
                  </div>
                </div>
              </Dropdown>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
        <Table>
          <TableCaption
            title="Журнал импортов"
            description="Последние операции загрузки и чтения файлов."
            right={
              <div className="text-[11px] text-white/45">
                {loading ? "Загружаю…" : `Показано: ${sorted.length} / ${items.length}`}
              </div>
            }
          />

          {loading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : err ? (
            <TableEmpty title="Ошибка" description={err} />
          ) : sorted.length === 0 ? (
            <TableEmpty
              title="Импортов пока нет"
              description="Список пуст. После запуска pipeline здесь появятся записи."
            />
          ) : (
            <TableScroll className="max-h-[70vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    <SortTh
                      label="id"
                      dir={sortKey === "id" ? sortDir : null}
                      onToggle={() => toggleSort("id", "desc")}
                    />
                    <SortTh
                      label="type"
                      dir={sortKey === "import_type" ? sortDir : null}
                      onToggle={() => toggleSort("import_type", "asc")}
                    />
                    <SortTh
                      label="file"
                      dir={sortKey === "file_name" ? sortDir : null}
                      onToggle={() => toggleSort("file_name", "asc")}
                    />
                    <SortTh
                      label="rows"
                      dir={sortKey === "rows_count" ? sortDir : null}
                      onToggle={() => toggleSort("rows_count", "desc")}
                    />
                    <SortTh
                      label="status"
                      dir={sortKey === "status" ? sortDir : null}
                      onToggle={() => toggleSort("status", "asc")}
                    />
                    <SortTh label="comment" dir={null} />
                    <SortTh
                      label="imported_at"
                      dir={sortKey === "imported_at" ? sortDir : null}
                      onToggle={() => toggleSort("imported_at", "desc")}
                    />
                  </tr>
                </THead>

                <TBody>
                  {sorted.map((row) => (
                    <Tr key={row.id}>
                      <Td className="font-semibold text-white/85">#{row.id}</Td>

                      <Td>
                        <div className="inline-flex items-center gap-2 text-white/80">
                          {row.import_type === "mapping" ? (
                            <FileText className="h-4 w-4 text-cyan-300/85" />
                          ) : (
                            <FileSpreadsheet className="h-4 w-4 text-cyan-300/85" />
                          )}
                          <span>{row.import_type}</span>
                        </div>
                      </Td>

                      <Td className="text-white/75">
                        <div className="max-w-[220px] truncate">{row.file_name || "—"}</div>
                        {row.source_path ? (
                          <div className="mt-0.5 max-w-[280px] truncate text-[11px] text-white/38">
                            {row.source_path}
                          </div>
                        ) : null}
                      </Td>

                      <Td className="tabular-nums text-white/75">{row.rows_count}</Td>

                      <Td>
                        <StatusBadge status={row.status} />
                      </Td>

                      <Td className="max-w-[280px] text-white/60">
                        <div className="truncate">{row.comment || "—"}</div>
                      </Td>

                      <Td className="text-white/55">{row.imported_at}</Td>
                    </Tr>
                  ))}
                </TBody>
              </TableInner>
            </TableScroll>
          )}
        </Table>
      </Card>
    </div>
  );
}