import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../ui/cn/cn";
import {
  ChevronRight,
  Home,
  History,
  Settings as SettingsIcon,
  ArrowUpRight,
  Command,
  KeyRound,
  LogOut,
  FileInput,
  BookOpen,
  Server,
} from "lucide-react";

import { Card } from "../ui/Card";
import { useAuth } from "../auth/AuthContext";

type Tab = {
  to: string;
  label: string;
  icon: React.ReactNode;
  match: (path: string) => boolean;
};

const TABS: Tab[] = [
  {
    to: "/",
    label: "Главная",
    icon: <Home className="h-4 w-4" />,
    match: (p) => p === "/" || p.startsWith("/dashboard"),
  },
  {
    to: "/runs",
    label: "Запуски",
    icon: <History className="h-4 w-4" />,
    match: (p) => p.startsWith("/runs"),
  },
  {
    to: "/licenses",
    label: "Лицензии",
    icon: <KeyRound className="h-4 w-4" />,
    match: (p) => p.startsWith("/licenses"),
  },
  {
    to: "/client-licenses",
    label: "Ключи",
    icon: <Server className="h-4 w-4" />,
    match: (p) => p.startsWith("/client-licenses"),
  },
  {
    to: "/imports",
    label: "Импорты",
    icon: <FileInput className="h-4 w-4" />,
    match: (p) => p.startsWith("/imports"),
  },
  {
    to: "/dictionaries/products",
    label: "Справочники",
    icon: <BookOpen className="h-4 w-4" />,
    match: (p) => p.startsWith("/dictionaries"),
  },
  {
    to: "/settings",
    label: "Настройки",
    icon: <SettingsIcon className="h-4 w-4" />,
    match: (p) => p.startsWith("/settings"),
  },
];

const BREAD_MAP: Record<string, string> = {
  runs: "Запуски",
  diff: "Сравнение",
  settings: "Настройки",
  licenses: "Лицензии",
  login: "Вход",
  imports: "Импорты",
  alerts: "Уведомления",
  dictionaries: "Справочники",
  products: "Продукты",
  mapping: "Правила сопоставления",
};
function humanizeSegment(seg: string) {
  if (/^\d+$/.test(seg)) return `#${seg}`;
  return BREAD_MAP[seg] ?? seg.replace(/[-_]/g, " ");
}

function isActiveTab(pathname: string, tab: Tab) {
  return tab.match(pathname);
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;

  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;

  return Boolean(
    el.closest?.('input, textarea, select, [contenteditable="true"]')
  );
}

function getIsMac() {
  if (typeof navigator === "undefined") return false;
  const p = navigator.platform?.toLowerCase?.() ?? "";
  const ua = navigator.userAgent?.toLowerCase?.() ?? "";
  return p.includes("mac") || ua.includes("mac os");
}

function SoftPillLink({
  to,
  active,
  icon,
  label,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold",
        "transition outline-none",
        "focus-visible:ring-2 focus-visible:ring-cyan-300/25",
        active
          ? cn(
            "text-white/92",
            "border border-cyan-200/18",
            "bg-gradient-to-b from-cyan-300/14 via-white/[0.07] to-white/[0.04]",
            "shadow-[0_14px_55px_rgba(34,211,238,0.10)]"
          )
          : cn(
            "text-white/72",
            "border border-white/[0.08]",
            "bg-white/[0.02]",
            "hover:bg-white/[0.05] hover:text-white/88 hover:border-white/[0.12]",
            "shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
          )
      )}
    >
      <span className={cn("text-white/55", active && "text-cyan-200/90")}>
        {icon}
      </span>
      <span className="leading-none">{label}</span>

      {active && (
        <span className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(120px_60px_at_50%_0%,rgba(255,255,255,0.28),transparent_72%)]" />
      )}
    </Link>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xl px-2 py-1",
        "border border-white/[0.10] bg-white/[0.03]",
        "text-[11px] font-semibold text-white/55"
      )}
    >
      {children}
    </span>
  );
}

function LogoutButton({
  onClick,
  busy,
}: {
  onClick: () => void | Promise<void>;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold",
        "border border-white/[0.10] bg-white/[0.04]",
        "text-white/88 hover:bg-white/[0.08] hover:border-white/[0.14]",
        "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        "shadow-[0_12px_40px_rgba(0,0,0,0.30)]"
      )}
      title="Выйти"
    >
      <LogOut className="h-4 w-4 text-white/70" />
      <span>Выйти</span>
    </button>
  );
}

export function PageHeader({
  title,
  right,
  subtitle,
  showTabs = true,
  showBreadcrumbs = true,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showTabs?: boolean;
  showBreadcrumbs?: boolean;
}) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const isMac = React.useMemo(() => getIsMac(), []);
  const { user, logout } = useAuth();

  const [logoutBusy, setLogoutBusy] = React.useState(false);

  const parts = React.useMemo(() => {
    const raw = pathname.split("/").filter(Boolean);
    return raw.map((p, i) => ({
      raw: p,
      label: humanizeSegment(p),
      href:
        "/" +
        raw
          .slice(0, i + 1)
          .map((x) => x)
          .join("/"),
    }));
  }, [pathname]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key === ",") {
        e.preventDefault();
        nav("/settings");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nav, isMac]);

  async function onLogout() {
    setLogoutBusy(true);
    try {
      await logout();
    } finally {
      setLogoutBusy(false);
    }
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden mb-4",
        "rounded-[30px] border border-white/[0.08]",
        "bg-gradient-to-b from-slate-950/72 via-slate-950/48 to-slate-950/28",
        "backdrop-blur-xl",
        "shadow-[0_24px_90px_rgba(0,0,0,0.52)]"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
      <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative p-4 md:p-5">
        <div className="flex flex-col gap-4">
          {/* TOP ROW */}
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3">
                {showTabs && (
                  <div className="flex flex-wrap items-center gap-2">
                    {TABS.map((t) => (
                      <SoftPillLink
                        key={t.to}
                        to={t.to}
                        label={t.label}
                        icon={t.icon}
                        active={isActiveTab(pathname, t)}
                      />
                    ))}

                    <div className="hidden lg:flex items-center gap-2 ml-1">
                      <Kbd>
                        <Command className="h-3.5 w-3.5" />
                        <span>{isMac ? "Cmd" : "Ctrl"}</span>
                        <span>+</span>
                        <span>,</span>
                      </Kbd>
                    </div>
                  </div>
                )}

                <div className="xl:hidden">
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start xl:self-auto">
              {right}
              <LogoutButton onClick={onLogout} busy={logoutBusy} />
            </div>
          </div>

          {/* BOTTOM ROW */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end">
            <div className="min-w-0">
              {showBreadcrumbs && (
                <nav className="flex flex-wrap items-center gap-1 text-[12px] text-white/45">
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1 rounded-xl px-2 py-1 hover:bg-white/[0.05] hover:text-white/70 transition"
                  >
                    <Home className="h-3.5 w-3.5" />
                    <span>Главная</span>
                  </Link>

                  {parts.map((p, idx) => (
                    <span key={p.href} className="inline-flex items-center gap-1">
                      <ChevronRight className="h-3.5 w-3.5 text-white/25" />
                      {idx < parts.length - 1 ? (
                        <Link
                          to={p.href}
                          className="rounded-xl px-2 py-1 hover:bg-white/[0.05] hover:text-white/70 transition"
                        >
                          {p.label}
                        </Link>
                      ) : (
                        <span className="rounded-xl px-2 py-1 text-white/70">
                          {p.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>
              )}

              <div className="mt-2">
                <div className="text-2xl md:text-3xl font-semibold tracking-tight text-white/92 truncate">
                  {title}
                </div>
                {subtitle && (
                  <div className="mt-1 text-sm text-white/50 truncate">
                    {subtitle}
                  </div>
                )}
              </div>
            </div>

            <div className="hidden xl:flex flex-col items-end gap-3">

            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}