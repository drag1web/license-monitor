import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  ShieldAlert,
  TriangleAlert,
  CircleAlert,
  ArrowUpRight,
  Trash2,
  RefreshCw,
  Inbox,
} from "lucide-react";
import {
  getAlerts,
  readAlert,
  readAllAlerts,
  deleteAlertById,
  deleteReadAlerts,
  type AlertRow,
} from "../api";
import { Card } from "../ui/Card";
import { cn } from "../ui/cn/cn";
import { PageHeader } from "../components/PageHeader";


type AlertsTab = "all" | "unread" | "critical";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function severityLabel(a: AlertRow) {
  if (a.severity === "critical") return "Критично";
  if (a.severity === "warn") return "Предупреждение";
  return "Информация";
}

function iconForAlert(a: AlertRow) {
  if (a.severity === "critical") {
    return <ShieldAlert className="h-5 w-5 text-red-600" />;
  }

  if (a.severity === "warn") {
    return <TriangleAlert className="h-5 w-5 text-amber-600" />;
  }

  return <CircleAlert className="h-5 w-5 text-slate-600" />;
}

function toneClasses(a: AlertRow) {
  if (a.severity === "critical") {
    return {
      card: "border-red-300 bg-red-50/80",
      icon: "border-red-200 bg-red-50",
      badge: "border-red-200 bg-red-50 text-red-700",
      accent: "bg-red-500",
    };
  }

  if (a.severity === "warn") {
    return {
      card: "border-amber-300 bg-amber-50/80",
      icon: "border-amber-200 bg-amber-50",
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      accent: "bg-amber-500",
    };
  }

  return {
    card: "border-slate-200 bg-white",
    icon: "border-slate-200 bg-slate-50",
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    accent: "bg-slate-400",
  };
}

function ActionButton({
  onClick,
  disabled,
  children,
  danger = false,
  leftIcon,
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
  leftIcon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
        danger
          ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        "disabled:cursor-not-allowed disabled:opacity-45"
      )}
    >
      {leftIcon}
      {children}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
  critical = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  critical?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium transition",
        active
          ? critical
            ? "border-red-600 bg-red-600 text-white"
            : "border-slate-900 bg-slate-900 text-white"
          : critical
            ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warn" | "critical";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
        tone === "critical"
          ? "border-red-200"
          : tone === "warn"
            ? "border-amber-200"
            : "border-slate-200"
      )}
    >
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "critical"
            ? "text-red-600"
            : tone === "warn"
              ? "text-amber-600"
              : "text-slate-950"
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [items, setItems] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AlertsTab>("all");
  const [err, setErr] = useState("");

  async function refresh(showLoader = true) {
    if (showLoader) setLoading(true);
    setErr("");

    try {
      const data = await getAlerts(200);
      setItems(data.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function onRead(id: number) {
    try {
      await readAlert(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
              ...item,
              is_read: 1,
              read_at: item.read_at ?? new Date().toISOString(),
            }
            : item
        )
      );
    } catch (e) {
      console.error(e);
      await refresh(false);
    }
  }

  async function onReadAll() {
    try {
      await readAllAlerts();
      const now = new Date().toISOString();

      setItems((prev) =>
        prev.map((item) =>
          item.is_read === 0
            ? { ...item, is_read: 1, read_at: item.read_at ?? now }
            : item
        )
      );
    } catch (e) {
      console.error(e);
      await refresh(false);
    }
  }

  async function onDelete(id: number) {
    try {
      await deleteAlertById(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      console.error(e);
      await refresh(false);
    }
  }

  async function onDeleteRead() {
    try {
      await deleteReadAlerts();
      setItems((prev) => prev.filter((item) => item.is_read === 0));
    } catch (e) {
      console.error(e);
      await refresh(false);
    }
  }

  useEffect(() => {
    refresh(true);
  }, []);

  const unreadCount = useMemo(
    () => items.filter((x) => x.is_read === 0).length,
    [items]
  );

  const criticalCount = useMemo(
    () => items.filter((x) => x.severity === "critical").length,
    [items]
  );

  const warnCount = useMemo(
    () => items.filter((x) => x.severity === "warn").length,
    [items]
  );

  const filteredItems = useMemo(() => {
    if (tab === "unread") return items.filter((x) => x.is_read === 0);
    if (tab === "critical") return items.filter((x) => x.severity === "critical");
    return items;
  }, [items, tab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Уведомления"
        subtitle="Системные события, предупреждения и критичные проблемы по результатам проверок."
      />
      <Card className="p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <StatCard label="Всего" value={items.length} />
            <StatCard label="Непрочитанных" value={unreadCount} tone="warn" />
            <StatCard label="Критичных" value={criticalCount} tone="critical" />
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-2">
              <TabButton active={tab === "all"} onClick={() => setTab("all")}>
                Все
              </TabButton>

              <TabButton
                active={tab === "unread"}
                onClick={() => setTab("unread")}
              >
                Непрочитанные {unreadCount}
              </TabButton>

              <TabButton
                active={tab === "critical"}
                onClick={() => setTab("critical")}
                critical
              >
                Критичные {criticalCount}
              </TabButton>
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton
                onClick={() => refresh(true)}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Обновить
              </ActionButton>

              <ActionButton
                onClick={onReadAll}
                disabled={items.length === 0 || unreadCount === 0}
                leftIcon={<CheckCheck className="h-4 w-4" />}
              >
                Прочитать все
              </ActionButton>

              <ActionButton
                onClick={onDeleteRead}
                disabled={items.length === 0 || items.every((x) => x.is_read === 0)}
                danger
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Удалить прочитанные
              </ActionButton>
              
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <Bell className="h-4 w-4 text-slate-500" />
              Список уведомлений
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Предупреждений: {warnCount} · Критичных: {criticalCount}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-5">
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
                />
              ))}
            </div>
          </div>
        ) : err ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {err}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200 bg-slate-50">
              <Inbox className="h-6 w-6 text-slate-400" />
            </div>

            <div className="mt-4 text-sm font-semibold text-slate-900">
              {tab === "all"
                ? "Пока нет уведомлений"
                : tab === "unread"
                  ? "Нет непрочитанных уведомлений"
                  : "Нет критичных уведомлений"}
            </div>

            <div className="mt-1 max-w-md text-sm text-slate-500">
              {tab === "all"
                ? "Когда появятся дефициты, истечения лицензий или ошибки обработки, они будут отображаться здесь."
                : tab === "unread"
                  ? "Все текущие уведомления уже отмечены как прочитанные."
                  : "Сейчас нет критичных событий, требующих немедленного внимания."}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredItems.map((a) => {
              const tone = toneClasses(a);

              return (
                <div
                  key={a.id}
                  className={cn(
                    "relative p-5 transition hover:bg-slate-50",
                    a.is_read === 0 && "bg-slate-50/70"
                  )}
                >
                  {a.is_read === 0 && (
                    <div className={cn("absolute left-0 top-0 h-full w-1", tone.accent)} />
                  )}

                  <div
                    className={cn(
                      "rounded-xl border p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)]",
                      tone.card
                    )}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div
                          className={cn(
                            "grid h-11 w-11 shrink-0 place-items-center rounded-xl border",
                            tone.icon
                          )}
                        >
                          {iconForAlert(a)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-950">
                              {a.title}
                            </div>

                            <span
                              className={cn(
                                "rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                                tone.badge
                              )}
                            >
                              {severityLabel(a)}
                            </span>

                            {a.is_read === 0 ? (
                              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                Новое
                              </span>
                            ) : (
                              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                Прочитано
                              </span>
                            )}
                          </div>

                          <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                            {a.message}
                          </div>

                          <div className="mt-3 text-xs text-slate-500">
                            {formatWhen(a.created_at)}
                            {a.run_id ? ` · запуск #${a.run_id}` : ""}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
                        {a.run_id ? (
                          <Link
                            to={`/runs/${a.run_id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Открыть
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        ) : null}

                        {a.is_read === 0 && (
                          <ActionButton onClick={() => onRead(a.id)}>
                            Прочитать
                          </ActionButton>
                        )}

                        <ActionButton
                          onClick={() => onDelete(a.id)}
                          danger
                          leftIcon={<Trash2 className="h-4 w-4" />}
                        >
                          Удалить
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}