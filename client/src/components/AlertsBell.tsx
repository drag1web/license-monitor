import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  CircleAlert,
  ShieldAlert,
  TriangleAlert,
  ArrowUpRight,
  Info,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  getAlerts,
  readAlert,
  readAllAlerts,
  deleteAlertById,
  deleteReadAlerts,
  type AlertRow,
} from "../api";
import { cn } from "../ui/cn/cn";

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

function toneOf(a: AlertRow): "critical" | "warn" | "info" {
  if (a.severity === "critical") return "critical";
  if (a.severity === "warn") return "warn";
  return "info";
}

function iconForAlert(a: AlertRow) {
  const tone = toneOf(a);

  if (tone === "critical") {
    return <ShieldAlert className="h-4 w-4 text-rose-300" />;
  }
  if (tone === "warn") {
    return <TriangleAlert className="h-4 w-4 text-amber-300" />;
  }
  return <CircleAlert className="h-4 w-4 text-cyan-300" />;
}

function severityLabel(a: AlertRow) {
  if (a.severity === "critical") return "critical";
  if (a.severity === "warn") return "warning";
  return "info";
}

function toneClasses(a: AlertRow) {
  const tone = toneOf(a);

  if (tone === "critical") {
    return {
      card: a.is_read
        ? "border-rose-500/15 bg-rose-500/[0.035]"
        : "border-rose-400/20 bg-rose-500/[0.07]",
      badge: "border border-rose-400/18 bg-rose-500/12 text-rose-200",
      glow: "shadow-[0_12px_32px_rgba(244,63,94,0.10)]",
      dot: "bg-rose-300 shadow-[0_0_14px_rgba(251,113,133,0.75)]",
    };
  }

  if (tone === "warn") {
    return {
      card: a.is_read
        ? "border-amber-500/15 bg-amber-500/[0.03]"
        : "border-amber-400/18 bg-amber-500/[0.06]",
      badge: "border border-amber-400/18 bg-amber-500/12 text-amber-200",
      glow: "shadow-[0_12px_32px_rgba(245,158,11,0.10)]",
      dot: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.75)]",
    };
  }

  return {
    card: a.is_read
      ? "border-cyan-500/15 bg-cyan-500/[0.025]"
      : "border-cyan-400/18 bg-cyan-500/[0.055]",
    badge: "border border-cyan-400/18 bg-cyan-500/12 text-cyan-200",
    glow: "shadow-[0_12px_32px_rgba(34,211,238,0.09)]",
    dot: "bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.75)]",
  };
}

function HeaderButton(props: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  const { onClick, disabled, title, children, danger = false } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-2xl border px-2.5 py-1.5 text-[11px] font-semibold transition active:scale-[0.98]",
        danger
          ? "border-rose-400/15 bg-rose-500/8 text-rose-200 hover:bg-rose-500/14"
          : "border-white/[0.08] bg-white/[0.04] text-white/80 hover:bg-white/[0.08] hover:border-white/[0.14]",
        "disabled:cursor-not-allowed disabled:opacity-45"
      )}
    >
      {children}
    </button>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "default" | "critical";
}) {
  const { active, onClick, children, tone = "default" } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-3 py-1.5 text-[11px] font-semibold transition",
        active
          ? tone === "critical"
            ? "border-rose-400/18 bg-rose-500/14 text-rose-200"
            : "border-cyan-400/18 bg-cyan-500/14 text-cyan-200"
          : "border-white/[0.08] bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
      )}
    >
      {children}
    </button>
  );
}

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AlertRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AlertsTab>("all");
  const [bellShakeKey, setBellShakeKey] = useState(0);
  const [highlightIds, setHighlightIds] = useState<number[]>([]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const prevUnreadRef = useRef(0);
  const prevIdsRef = useRef<number[]>([]);

  async function refresh(showLoader = false) {
    if (showLoader) setLoading(true);

    try {
      const data = await getAlerts(20);
      const nextItems = data.items ?? [];
      const nextUnread = Number(data.unread ?? 0);

      const prevUnread = prevUnreadRef.current;
      const prevIds = new Set(prevIdsRef.current);

      const newIncomingIds = nextItems
        .filter((item) => !prevIds.has(item.id))
        .map((item) => item.id);

      setItems(nextItems);
      setUnread(nextUnread);

      if (nextUnread > prevUnread) {
        setBellShakeKey((v) => v + 1);
      }

      if (newIncomingIds.length > 0) {
        setHighlightIds((prev) => Array.from(new Set([...prev, ...newIncomingIds])));

        window.setTimeout(() => {
          setHighlightIds((prev) => prev.filter((id) => !newIncomingIds.includes(id)));
        }, 2600);
      }

      prevUnreadRef.current = nextUnread;
      prevIdsRef.current = nextItems.map((x) => x.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      if (msg.includes("unauthorized")) {
        setItems([]);
        setUnread(0);
        setOpen(false);
        return;
      }

      console.error("alerts load error:", e);
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

      setUnread((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error("read alert error:", e);
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
            ? {
                ...item,
                is_read: 1,
                read_at: item.read_at ?? now,
              }
            : item
        )
      );

      setUnread(0);
    } catch (e) {
      console.error("read all alerts error:", e);
      await refresh(false);
    }
  }

  async function onDelete(id: number) {
    const target = items.find((x) => x.id === id);

    try {
      await deleteAlertById(id);

      setItems((prev) => prev.filter((item) => item.id !== id));
      setHighlightIds((prev) => prev.filter((x) => x !== id));

      if (target?.is_read === 0) {
        setUnread((prev) => Math.max(0, prev - 1));
      }
    } catch (e) {
      console.error("delete alert error:", e);
      await refresh(false);
    }
  }

  async function onDeleteRead() {
    try {
      await deleteReadAlerts();

      setItems((prev) => prev.filter((item) => item.is_read === 0));
      setHighlightIds((prev) =>
        prev.filter((id) => items.some((item) => item.id === id && item.is_read === 0))
      );
    } catch (e) {
      console.error("delete read alerts error:", e);
      await refresh(false);
    }
  }

  useEffect(() => {
    function onRefresh() {
      refresh(false);
    }

    refresh(true);

    const id = window.setInterval(() => refresh(false), 15000);
    window.addEventListener("alerts:refresh", onRefresh as EventListener);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("alerts:refresh", onRefresh as EventListener);
    };
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onEsc);
    }

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const unreadItems = useMemo(() => items.filter((x) => x.is_read === 0).length, [items]);
  const criticalItems = useMemo(
    () => items.filter((x) => x.severity === "critical").length,
    [items]
  );

  const filteredItems = useMemo(() => {
    if (tab === "unread") return items.filter((x) => x.is_read === 0);
    if (tab === "critical") return items.filter((x) => x.severity === "critical");
    return items;
  }, [items, tab]);

  return (
    <div className="relative" ref={rootRef}>
      <motion.button
        key={bellShakeKey}
        initial={false}
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) {
              refresh(true);
            } else {
              setTab("all");
            }
            return next;
          });
        }}
        title="Alerts"
        animate={
          unread > 0
            ? {
                boxShadow: [
                  "0 10px 30px rgba(0,0,0,0.35)",
                  "0 10px 30px rgba(0,0,0,0.35), 0 0 0 6px rgba(244,63,94,0.10)",
                  "0 10px 30px rgba(0,0,0,0.35)",
                ],
                y: [0, -1, 0],
                rotate: bellShakeKey > 0 ? [0, -9, 7, -5, 3, -1, 0] : 0,
              }
            : {
                boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                y: 0,
                rotate: 0,
              }
        }
        transition={
          unread > 0
            ? {
                boxShadow: {
                  duration: 1.8,
                  repeat: Infinity,
                  repeatDelay: 1.15,
                },
                y: {
                  duration: 1.8,
                  repeat: Infinity,
                  repeatDelay: 1.15,
                },
                rotate: {
                  duration: 0.48,
                },
              }
            : { duration: 0.2 }
        }
        className={cn(
          "relative grid h-9 w-9 place-items-center rounded-2xl border",
          "border-white/[0.08] bg-white/[0.04]",
          "text-white/80",
          "transition hover:-translate-y-[1px] hover:bg-white/[0.08] hover:border-white/[0.14]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/30"
        )}
      >
        <Bell className="h-4 w-4" />

        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0.72, opacity: 0 }}
              animate={{ scale: [0.9, 1.18, 1], opacity: 1 }}
              exit={{ scale: 0.72, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className={cn(
                "absolute -right-1 -top-1 min-w-[18px] rounded-full px-1.5 py-0.5",
                "bg-rose-500 text-[10px] font-bold leading-none text-white",
                "shadow-[0_8px_20px_rgba(244,63,94,0.45)]"
              )}
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <div
        className={cn(
          "absolute right-0 top-11 z-[80] w-[404px] origin-top-right overflow-hidden rounded-3xl border",
          "border-white/[0.10] bg-slate-950/92 backdrop-blur-2xl",
          "shadow-[0_24px_80px_rgba(0,0,0,0.55)]",
          "transition-all duration-200 ease-out",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0"
        )}
      >
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-white/90">Уведомления</div>
                {unread > 0 && (
                  <span className="rounded-xl bg-rose-500/12 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                    {unread}
                  </span>
                )}
              </div>

              <div className="mt-1 text-[11px] text-white/45">
                Всего: {items.length} · Непрочитанных: {unreadItems}
              </div>
            </div>

            <Link
              to="/alerts"
              onClick={() => setOpen(false)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-2xl border px-2.5 py-1.5 text-[11px] font-semibold transition",
                "border-white/[0.08] bg-white/[0.04] text-cyan-200",
                "hover:bg-white/[0.08] hover:border-white/[0.14]"
              )}
            >
              Все
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TabButton active={tab === "all"} onClick={() => setTab("all")}>
              All
            </TabButton>

            <TabButton active={tab === "unread"} onClick={() => setTab("unread")}>
              Unread
              {unreadItems > 0 && (
                <span className="ml-1.5 text-[10px] text-cyan-300/85">{unreadItems}</span>
              )}
            </TabButton>

            <TabButton
              active={tab === "critical"}
              onClick={() => setTab("critical")}
              tone="critical"
            >
              Critical
              {criticalItems > 0 && (
                <span className="ml-1.5 text-[10px] text-rose-300/85">{criticalItems}</span>
              )}
            </TabButton>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <HeaderButton
                onClick={onReadAll}
                disabled={items.length === 0 || unread === 0}
                title="Отметить все как прочитанные"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Прочитать
              </HeaderButton>

              <HeaderButton
                onClick={onDeleteRead}
                disabled={items.length === 0 || items.every((x) => x.is_read === 0)}
                danger
                title="Удалить все прочитанные"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Очистить
              </HeaderButton>
            </div>
          </div>
        </div>

        <div className="max-h-[440px] overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-8 text-sm text-white/45">
              <Info className="h-4 w-4" />
              Загрузка уведомлений...
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              className={cn(
                "rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center",
                "shadow-[0_12px_30px_rgba(0,0,0,0.24)]"
              )}
            >
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-white/[0.04]">
                <Bell className="h-5 w-5 text-white/40" />
              </div>

              <div className="mt-3 text-sm font-semibold text-white/80">
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
            <motion.div
              className="space-y-2.5"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: {
                  transition: {
                    staggerChildren: 0.045,
                  },
                },
              }}
            >
              <AnimatePresence initial={false}>
                {filteredItems.map((a) => {
                  const tone = toneClasses(a);
                  const isHighlighted = highlightIds.includes(a.id);

                  return (
                    <motion.div
                      key={a.id}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.985 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: isHighlighted ? [1, 1.012, 1] : 1,
                      }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className={cn(
                        "group rounded-2xl border p-3 transition",
                        "hover:-translate-y-[1px] hover:border-white/[0.16]",
                        tone.card,
                        tone.glow,
                        isHighlighted &&
                          "ring-2 ring-cyan-300/30 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_18px_44px_rgba(34,211,238,0.12)]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl",
                            "border border-white/[0.06] bg-white/[0.045]"
                          )}
                        >
                          {iconForAlert(a)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-sm font-semibold text-white/90">
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
                              </div>

                              <div className="mt-1 text-xs leading-relaxed text-white/60">
                                {a.message}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <AnimatePresence>
                                {a.is_read === 0 && (
                                  <motion.span
                                    initial={{ scale: 0.7, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.4, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", tone.dot)}
                                  />
                                )}
                              </AnimatePresence>

                              <button
                                type="button"
                                onClick={() => onDelete(a.id)}
                                title="Удалить уведомление"
                                className={cn(
                                  "grid h-7 w-7 place-items-center rounded-xl border",
                                  "border-white/[0.08] bg-white/[0.04] text-white/45",
                                  "transition hover:bg-rose-500/12 hover:border-rose-400/18 hover:text-rose-200"
                                )}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] text-white/38">
                              {formatWhen(a.created_at)}
                              {a.run_id ? ` · run #${a.run_id}` : ""}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {a.run_id ? (
                                <Link
                                  to={`/runs/${a.run_id}`}
                                  onClick={() => setOpen(false)}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-[11px] font-semibold",
                                    "border-white/[0.08] bg-white/[0.04] text-cyan-200",
                                    "transition hover:bg-white/[0.08] hover:border-white/[0.14]"
                                  )}
                                >
                                  Открыть
                                  <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                              ) : null}

                              {a.is_read === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => onRead(a.id)}
                                  className={cn(
                                    "rounded-2xl border px-3 py-1.5 text-[11px] font-semibold",
                                    "border-white/[0.08] bg-white/[0.04] text-white/80",
                                    "transition hover:bg-white/[0.08] hover:border-white/[0.14]"
                                  )}
                                >
                                  Прочитать
                                </button>
                              ) : (
                                <span className="text-[11px] text-white/32">Прочитано</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}