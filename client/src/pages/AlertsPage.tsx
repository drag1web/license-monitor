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

type AlertsTab = "all" | "unread" | "critical";

const CARD_SHADOW = "shadow-[0_24px_80px_rgba(0,0,0,0.36)]";
const SOFT_BORDER = "border-[rgba(100,130,170,0.18)]";
const SOFT_BORDER_HOVER = "hover:border-[rgba(120,155,205,0.28)]";
const GLASS_BG = "bg-[rgba(var(--card),0.26)]";
const GLASS_BG_SOFT = "bg-[rgba(var(--card),0.18)]";
const GLASS_BG_STRONG =
  "bg-[linear-gradient(to_bottom,rgba(var(--card),0.46),rgba(var(--card),0.22))]";

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
  if (a.severity === "critical") return "critical";
  if (a.severity === "warn") return "warning";
  return "info";
}

function iconForAlert(a: AlertRow) {
  if (a.severity === "critical") {
    return <ShieldAlert className="h-4 w-4 text-rose-300" />;
  }
  if (a.severity === "warn") {
    return <TriangleAlert className="h-4 w-4 text-amber-300" />;
  }
  return <CircleAlert className="h-4 w-4 text-cyan-300" />;
}

function toneClasses(a: AlertRow) {
  if (a.severity === "critical") {
    return {
      card: a.is_read
        ? "border-rose-500/15 bg-rose-500/[0.04]"
        : "border-rose-400/22 bg-rose-500/[0.08]",
      badge: "bg-rose-500/12 text-rose-200 border border-rose-400/18",
    };
  }

  if (a.severity === "warn") {
    return {
      card: a.is_read
        ? "border-amber-500/15 bg-amber-500/[0.035]"
        : "border-amber-400/20 bg-amber-500/[0.07]",
      badge: "bg-amber-500/12 text-amber-200 border border-amber-400/18",
    };
  }

  return {
    card: a.is_read
      ? "border-cyan-500/15 bg-cyan-500/[0.03]"
      : "border-cyan-400/18 bg-cyan-500/[0.06]",
    badge: "bg-cyan-500/12 text-cyan-200 border border-cyan-400/18",
  };
}

function ActionButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  danger?: boolean;
  leftIcon?: React.ReactNode;
}) {
  const { onClick, disabled, children, danger = false, leftIcon } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition outline-none",
        danger
          ? "border-rose-400/15 bg-rose-500/8 text-rose-200 hover:bg-rose-500/14"
          : `${SOFT_BORDER} ${GLASS_BG} text-[rgba(var(--fg),0.86)] hover:bg-[rgba(var(--card),0.38)] ${SOFT_BORDER_HOVER}`,
        "disabled:cursor-not-allowed disabled:opacity-45"
      )}
    >
      {leftIcon}
      {children}
    </button>
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

  const filteredItems = useMemo(() => {
    if (tab === "unread") return items.filter((x) => x.is_read === 0);
    if (tab === "critical") return items.filter((x) => x.severity === "critical");
    return items;
  }, [items, tab]);

  return (
    <div className="space-y-6">
      <Card className={cn("rounded-3xl p-5 md:p-6", CARD_SHADOW)}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[rgba(var(--fg),0.88)]">
              <Bell className="h-5 w-5 text-cyan-400" />
              <span className="text-2xl font-semibold tracking-tight">Уведомления</span>
            </div>

            <div className="mt-2 text-sm text-[rgba(var(--fg),0.56)]">
              История системных alerts, ошибок и предупреждений.
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("all")}
                className={cn(
                  "rounded-2xl border px-3 py-1.5 text-[12px] font-semibold transition",
                  tab === "all"
                    ? "border-cyan-400/18 bg-cyan-500/14 text-cyan-200"
                    : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                )}
              >
                All
              </button>

              <button
                type="button"
                onClick={() => setTab("unread")}
                className={cn(
                  "rounded-2xl border px-3 py-1.5 text-[12px] font-semibold transition",
                  tab === "unread"
                    ? "border-cyan-400/18 bg-cyan-500/14 text-cyan-200"
                    : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                )}
              >
                Unread
                {unreadCount > 0 && (
                  <span className="ml-1.5 text-[10px] text-cyan-300/85">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setTab("critical")}
                className={cn(
                  "rounded-2xl border px-3 py-1.5 text-[12px] font-semibold transition",
                  tab === "critical"
                    ? "border-rose-400/18 bg-rose-500/14 text-rose-200"
                    : "border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
                )}
              >
                Critical
                {criticalCount > 0 && (
                  <span className="ml-1.5 text-[10px] text-rose-300/85">
                    {criticalCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={() => refresh(true)} leftIcon={<RefreshCw className="h-4 w-4" />}>
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
      </Card>

      <Card className={cn("rounded-3xl p-5", CARD_SHADOW)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className={cn("rounded-2xl border p-4", SOFT_BORDER, GLASS_BG_STRONG)}>
            <div className="text-[11px] text-[rgba(var(--fg),0.46)]">Всего</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{items.length}</div>
          </div>

          <div className={cn("rounded-2xl border p-4", SOFT_BORDER, GLASS_BG_STRONG)}>
            <div className="text-[11px] text-[rgba(var(--fg),0.46)]">Непрочитанных</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{unreadCount}</div>
          </div>

          <div className={cn("rounded-2xl border p-4", SOFT_BORDER, GLASS_BG_STRONG)}>
            <div className="text-[11px] text-[rgba(var(--fg),0.46)]">Критичных</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{criticalCount}</div>
          </div>
        </div>
      </Card>

      <Card className={cn("rounded-3xl p-5", CARD_SHADOW)}>
        {loading ? (
          <div className="py-10 text-sm text-[rgba(var(--fg),0.46)]">Загрузка...</div>
        ) : err ? (
          <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {err}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-10 text-center">
            <div className="text-sm font-semibold text-white/80">
              {tab === "all"
                ? "Пока нет уведомлений"
                : tab === "unread"
                ? "Нет непрочитанных уведомлений"
                : "Нет критичных уведомлений"}
            </div>
            <div className="mt-1 text-xs text-white/45">
              {tab === "all"
                ? "Когда появятся дефициты, истечения или ошибки — они будут здесь."
                : tab === "unread"
                ? "Все уведомления уже прочитаны."
                : "Сейчас нет критичных проблем."}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((a) => {
              const tone = toneClasses(a);

              return (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-2xl border p-4 transition hover:-translate-y-[1px] hover:border-white/[0.16]",
                    tone.card
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/[0.06] bg-white/[0.045]">
                      {iconForAlert(a)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-white/90">
                              {a.title}
                            </div>

                            <span
                              className={cn(
                                "rounded-xl px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                tone.badge
                              )}
                            >
                              {severityLabel(a)}
                            </span>

                            {a.is_read === 0 && (
                              <span className="rounded-xl bg-cyan-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
                                unread
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-sm text-white/60">{a.message}</div>

                          <div className="mt-3 text-[12px] text-white/38">
                            {formatWhen(a.created_at)}
                            {a.run_id ? ` · run #${a.run_id}` : ""}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {a.run_id ? (
                            <Link
                              to={`/runs/${a.run_id}`}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-[12px] font-semibold",
                                "border-white/[0.08] bg-white/[0.04] text-cyan-200",
                                "transition hover:bg-white/[0.08] hover:border-white/[0.14]"
                              )}
                            >
                              Открыть
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}

                          {a.is_read === 0 ? (
                            <ActionButton onClick={() => onRead(a.id)}>
                              Прочитать
                            </ActionButton>
                          ) : (
                            <span className="px-2 text-[12px] text-white/35">Прочитано</span>
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
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}