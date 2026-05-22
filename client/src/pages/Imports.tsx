import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Play,
  ArrowUpRight,
  GitBranch,
  ShieldCheck,
} from "lucide-react";
import {
  getImports,
  uploadImport,
  runCheck,
  cleanupImportsKeepLast,
  type ImportRow,
} from "../api";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Dropdown } from "../components/Dropdown";
import { useAuth } from "../auth/AuthContext";

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

function statusText(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "success") return "Успешно";
  if (s === "failed") return "Ошибка";
  if (s === "partial") return "Частично";
  return status || "Неизвестно";
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium",
        tone === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-700",
        tone === "bad" && "border-red-200 bg-red-50 text-red-700",
        tone === "none" && "border-slate-200 bg-slate-50 text-slate-600"
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
      {statusText(status)}
    </span>
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

function FilterButton({
  active,
  children,
  onClick,
  tone = "default",
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "ok" | "warn" | "bad";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium transition",
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
    >
      {children}
    </button>
  );
}

function ImportKindCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      <div className="mt-1 text-xs leading-relaxed text-slate-500">{text}</div>
    </div>
  );
}

export default function Imports() {
  const navigate = useNavigate();

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
  const [runOnlyBusy, setRunOnlyBusy] = useState(false);
  const [lastCreatedRunId, setLastCreatedRunId] = useState<number | null>(null);
  const [lastUploadedName, setLastUploadedName] = useState<string | null>(null);

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

  async function runAndOpen() {
    if (!isAdmin) return;

    setRunOnlyBusy(true);
    setErr("");

    try {
      const runOut = await runCheck();

      if (!runOut.ok) {
        throw new Error(runOut.error || "run failed");
      }

      window.dispatchEvent(new CustomEvent("alerts:refresh"));

      if (runOut.runId) {
        setLastCreatedRunId(runOut.runId);
        navigate(`/runs/${runOut.runId}`);
        return;
      }

      navigate("/runs");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRunOnlyBusy(false);
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
      const fileName = uploadFile.name;

      const out = await uploadImport(uploadType, uploadFile);
      if (!out.ok) {
        throw new Error(out.error || "upload failed");
      }

      setLastUploadedName(fileName);

      await refresh();

      if (runAfter) {
        const runOut = await runCheck();

        if (!runOut.ok) {
          throw new Error(runOut.error || "run failed");
        }

        window.dispatchEvent(new CustomEvent("alerts:refresh"));

        if (runOut.runId) {
          setLastCreatedRunId(runOut.runId);
          setUploadFile(null);
          navigate(`/runs/${runOut.runId}`);
          return;
        }

        navigate("/runs");
        return;
      }

      setUploadFile(null);
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
    <div className="space-y-6">

      <Card className="p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <FolderInput className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="text-xl font-semibold text-slate-950">Импорты</div>

              <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Журнал загрузки CSV-файлов. Файл установок используется напрямую, а данные лицензий и правил сопоставления после загрузки сохраняются в систему и используются при расчёте.
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Database className="h-4 w-4" />
                <span>
                  Всего записей:{" "}
                  <span className="font-semibold text-slate-800">{stats.total}</span>
                </span>

                <StatusBadge
                  status={
                    stats.failed > 0
                      ? "failed"
                      : stats.partial > 0
                        ? "partial"
                        : "success"
                  }
                />

                {lastCreatedRunId && (
                  <Link
                    to={`/runs/${lastCreatedRunId}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Открыть запуск #{lastCreatedRunId}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Обновить
            </Button>

            {isAdmin && (
              <>
                <Button
                  size="sm"
                  onClick={() => void runAndOpen()}
                  disabled={runOnlyBusy || uploadAndRunBusy || uploading}
                >
                  <Play className={cn("h-4 w-4", runOnlyBusy && "animate-pulse")} />
                  {runOnlyBusy ? "Запуск..." : "Запустить проверку"}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCleanup}
                  disabled={cleanupBusy}
                >
                  <Trash2 className="h-4 w-4" />
                  {cleanupBusy ? "Очистка..." : "Очистить старые"}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {isAdmin && (
        <Card className="p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
            <div>
              <div className="text-sm font-semibold text-slate-950">
                Ручная загрузка CSV
              </div>

              <div className="mt-1 text-sm leading-6 text-slate-600">
                Выберите тип файла, загрузите CSV и при необходимости сразу запустите
                новую проверку. Если выбран режим “Загрузить и запустить”, после
                выполнения откроется новый RunDetails.
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[220px_minmax(0,1fr)]">
                <div className="relative">
                  <button
                    ref={uploadTypeBtnRef}
                    type="button"
                    onClick={() => setUploadTypeOpen((v) => !v)}
                    className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <span>
                      {uploadType === "installations"
                        ? "Установки (CSV)"
                        : uploadType === "licenses"
                          ? "Импорт в реестр лицензий"
                          : "Импорт правил сопоставления"}
                    </span>
                    <span className="text-slate-400">▾</span>
                  </button>

                  <Dropdown
                    open={uploadTypeOpen}
                    onClose={() => setUploadTypeOpen(false)}
                    anchorRef={uploadTypeBtnRef as React.RefObject<HTMLElement>}
                    width={220}
                    align="start"
                    className="p-1"
                  >
                    <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {(["installations", "licenses", "mapping"] as const).map(
                        (item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              setUploadType(item);
                              setUploadTypeOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition",
                              uploadType === item
                                ? "bg-slate-100 text-slate-950"
                                : "text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            <span>
                              {item === "installations"
                                ? "Установки (CSV)"
                                : item === "licenses"
                                  ? "Импорт в реестр лицензий"
                                  : "Импорт правил сопоставления"}
                            </span>
                            {uploadType === item ? (
                              <span className="text-slate-500">✓</span>
                            ) : null}
                          </button>
                        )
                      )}
                    </div>
                  </Dropdown>
                </div>

                <label className="flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
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
                    {uploadFile ? uploadFile.name : "Выбрать CSV-файл"}
                  </span>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => void onUpload(false)}
                  disabled={!uploadFile || uploading || uploadAndRunBusy || runOnlyBusy}
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Загрузка..." : "Загрузить"}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onUpload(true)}
                  disabled={!uploadFile || uploading || uploadAndRunBusy || runOnlyBusy}
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      uploadAndRunBusy && "animate-spin"
                    )}
                  />
                  {uploadAndRunBusy ? "Загрузка + запуск..." : "Загрузить и запустить"}
                </Button>

                {lastUploadedName && (
                  <span className="text-xs text-slate-500">
                    Последний файл:{" "}
                    <span className="font-semibold text-slate-700">
                      {lastUploadedName}
                    </span>
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>Очистка журнала:</span>

                <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <span>Оставить</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={keepLast}
                    onChange={(e) =>
                      setKeepLast(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-16 bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  />
                  <span>записей</span>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <ImportKindCard
                title="installations"
                text="Фактические установки ПО. Используются как основной источник данных при расчёте."
                icon={<FileSpreadsheet className="h-4 w-4 text-slate-500" />}
              />

              <ImportKindCard
                title="licenses"
                text="Импорт данных в реестр лицензий. После загрузки данные сохраняются в систему и используются при расчёте."
                icon={<ShieldCheck className="h-4 w-4 text-slate-500" />}
              />

              <ImportKindCard
                title="mapping"
                text="Импорт правил сопоставления. Загруженные правила сохраняются в справочник и применяются при обработке установок."
                icon={<GitBranch className="h-4 w-4 text-slate-500" />}
              />
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniStat
          label="Всего"
          value={stats.total}
          icon={<Database className="h-4 w-4" />}
        />
        <MiniStat
          label="Успешно"
          value={stats.success}
          tone="ok"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <MiniStat
          label="Частично"
          value={stats.partial}
          tone="warn"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <MiniStat
          label="Ошибки"
          value={stats.failed}
          tone="bad"
          icon={<XCircle className="h-4 w-4" />}
        />
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="text-sm font-semibold text-red-700">Ошибка</div>
          <div className="mt-1 break-words text-xs text-red-600">{err}</div>
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="flex items-center gap-2 text-slate-700">
            <Filter className="h-4 w-4" />
            <div className="text-sm font-semibold">Фильтры и поиск</div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-slate-100">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск: файл, путь, статус, комментарий..."
                className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-end">
              <button
                ref={filtersBtnRef}
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Filter className="h-4 w-4" />
                Фильтры
                <span className="text-blue-600">
                  {typeFilter !== "all" || statusFilter !== "all" ? "•" : ""}
                </span>
              </button>

              <Dropdown
                open={filtersOpen}
                onClose={() => setFiltersOpen(false)}
                anchorRef={filtersBtnRef as React.RefObject<HTMLElement>}
                width={360}
                align="end"
                className="p-1"
              >
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Тип импорта
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "all", label: "Все" },
                        { value: "installations", label: "Установки" },
                        { value: "licenses", label: "Лицензии" },
                        { value: "mapping", label: "Сопоставление" },
                      ].map((item) => (
                        <FilterButton
                          key={item.value}
                          active={typeFilter === item.value}
                          onClick={() =>
                            setTypeFilter(
                              item.value as
                              | "all"
                              | "installations"
                              | "licenses"
                              | "mapping"
                            )
                          }
                        >
                          {item.label}
                        </FilterButton>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Статус
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "all", label: "Все", tone: "default" },
                        { value: "success", label: "Успешно", tone: "ok" },
                        { value: "partial", label: "Частично", tone: "warn" },
                        { value: "failed", label: "Ошибка", tone: "bad" },
                      ].map((item) => (
                        <FilterButton
                          key={item.value}
                          active={statusFilter === item.value}
                          tone={item.tone as "default" | "ok" | "warn" | "bad"}
                          onClick={() =>
                            setStatusFilter(
                              item.value as "all" | "success" | "partial" | "failed"
                            )
                          }
                        >
                          {item.label}
                        </FilterButton>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTypeFilter("all");
                        setStatusFilter("all");
                      }}
                    >
                      Сбросить
                    </Button>

                    <Button size="sm" onClick={() => setFiltersOpen(false)}>
                      Готово
                    </Button>
                  </div>
                </div>
              </Dropdown>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableCaption
            title="Журнал импортов"
            description="Последние операции загрузки и чтения файлов."
            right={
              <div className="text-xs text-slate-500">
                {loading ? "Загрузка..." : `Показано: ${sorted.length} / ${items.length}`}
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
              description="Список пуст. После загрузки CSV здесь появятся записи."
            />
          ) : (
            <TableScroll className="max-h-[70vh]">
              <TableInner stickyHeader density="comfortable">
                <THead>
                  <tr>
                    <SortTh
                      label="ID"
                      dir={sortKey === "id" ? sortDir : null}
                      onToggle={() => toggleSort("id", "desc")}
                    />
                    <SortTh
                      label="Тип"
                      dir={sortKey === "import_type" ? sortDir : null}
                      onToggle={() => toggleSort("import_type", "asc")}
                    />
                    <SortTh
                      label="Файл"
                      dir={sortKey === "file_name" ? sortDir : null}
                      onToggle={() => toggleSort("file_name", "asc")}
                    />
                    <SortTh
                      label="Строк"
                      dir={sortKey === "rows_count" ? sortDir : null}
                      onToggle={() => toggleSort("rows_count", "desc")}
                    />
                    <SortTh
                      label="Статус"
                      dir={sortKey === "status" ? sortDir : null}
                      onToggle={() => toggleSort("status", "asc")}
                    />
                    <SortTh label="Комментарий" dir={null} />
                    <SortTh
                      label="Дата импорта"
                      dir={sortKey === "imported_at" ? sortDir : null}
                      onToggle={() => toggleSort("imported_at", "desc")}
                    />
                  </tr>
                </THead>

                <TBody>
                  {sorted.map((row) => (
                    <Tr key={row.id}>
                      <Td className="font-semibold text-slate-900">#{row.id}</Td>

                      <Td>
                        <div className="inline-flex items-center gap-2 text-slate-700">
                          {row.import_type === "mapping" ? (
                            <FileText className="h-4 w-4 text-slate-500" />
                          ) : (
                            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                          )}
                          <span>
                            {row.import_type === "installations"
                              ? "Установки"
                              : row.import_type === "licenses"
                                ? "Лицензии (в реестр)"
                                : "Сопоставление"}
                          </span>
                        </div>
                      </Td>

                      <Td className="text-slate-700">
                        <div className="max-w-[220px] truncate">
                          {row.file_name || "—"}
                        </div>
                        {row.source_path ? (
                          <div className="mt-0.5 max-w-[280px] truncate text-xs text-slate-500">
                            {row.source_path}
                          </div>
                        ) : null}
                      </Td>

                      <Td className="tabular-nums text-slate-700">
                        {row.rows_count}
                      </Td>

                      <Td>
                        <StatusBadge status={row.status} />
                      </Td>

                      <Td className="max-w-[280px] text-slate-600">
                        <div className="truncate">{row.comment || "—"}</div>
                      </Td>

                      <Td className="text-slate-500">{row.imported_at}</Td>
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