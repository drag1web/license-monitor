import React from "react";
import {
  Clock3,
  Gauge,
  ShieldCheck,
  User as UserIcon,
  Sparkles,
  Server,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "../ui/cn/cn";
import { useAuth } from "../auth/AuthContext";

type Tone = "ok" | "warn" | "bad";

const STORAGE_KEY = "lm_status_dock_collapsed";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function useNow(tickMs = 1000) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);

  return now;
}

function useStartedAt() {
  const ref = React.useRef<number>(Date.now());
  return ref.current;
}

function useUptime(startedAt: number) {
  const now = useNow(1000);
  const sec = Math.floor((now - startedAt) / 1000);

  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function useReduceMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();

    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

function useIsNarrow(breakpoint = 1280) {
  const [narrow, setNarrow] = React.useState(() =>
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );

  React.useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return narrow;
}

function PulseDot({ tone = "ok" }: { tone?: Tone }) {
  const reduceMotion = useReduceMotion();

  const cls =
    tone === "ok"
      ? "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.40)]"
      : tone === "warn"
        ? "bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.40)]"
        : "bg-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.40)]";

  return (
    <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
      <span className={cn("h-2.5 w-2.5 rounded-full", cls)} />
      {!reduceMotion && (
        <span className={cn("absolute h-4 w-4 rounded-full opacity-20 animate-ping", cls)} />
      )}
    </span>
  );
}

function toneClass(tone: Tone) {
  if (tone === "ok") {
    return "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";
  }
  if (tone === "warn") {
    return "border-amber-300/20 bg-amber-500/10 text-amber-100";
  }
  return "border-rose-300/20 bg-rose-500/10 text-rose-100";
}

function AnimatedBolt() {
  const reduceMotion = useReduceMotion();

  return (
    <Sparkles
      className={cn(
        "h-4 w-4 text-cyan-200/90",
        !reduceMotion && "animate-[pulse_1.8s_ease-in-out_infinite]"
      )}
    />
  );
}

function MiniCard({
  icon,
  label,
  value,
  tone,
  accent = false,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  accent?: boolean;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border px-3 py-2.5 min-w-0",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-[1px] hover:border-white/[0.12]",
        accent && tone
          ? toneClass(tone)
          : "border-white/[0.08] bg-white/[0.04] text-white/85",
        "animate-[statusDockIn_.45s_ease-out_both]"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60" />
      <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/5 blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-center gap-2.5 min-w-0 relative">
        <div
          className={cn(
            "h-8 w-8 shrink-0 rounded-xl grid place-items-center border transition-all duration-300",
            accent && tone
              ? "border-white/10 bg-white/10"
              : "border-white/[0.08] bg-white/[0.04] text-white/65 group-hover:text-white/80"
          )}
        >
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-[10px] leading-none text-white/45">{label}</div>
          <div className="mt-1 text-[13px] font-semibold leading-none truncate">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function DockToggleButton({
  collapsed,
  onClick,
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? "Показать панель" : "Скрыть панель"}
      className={cn(
        "inline-flex items-center justify-center h-9 w-9 rounded-2xl",
        "border border-white/[0.10] bg-white/[0.05] text-white/75",
        "hover:bg-white/[0.08] hover:text-white/90 hover:border-white/[0.14]",
        "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
      )}
    >
      {collapsed ? (
        <PanelRightOpen className="h-4 w-4" />
      ) : (
        <PanelRightClose className="h-4 w-4" />
      )}
    </button>
  );
}

export function AppStatusDock() {
  const { user } = useAuth();

  const startedAt = useStartedAt();
  const uptime = useUptime(startedAt);
  const now = useNow(1000);
  const reduceMotion = useReduceMotion();
  const isNarrow = useIsNarrow(1380);

  const [manualCollapsed, setManualCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, manualCollapsed ? "1" : "0");
  }, [manualCollapsed]);

  const collapsed = manualCollapsed || isNarrow;

  const backendTone: Tone = "ok";
  const secureTone: Tone = user?.role === "admin" ? "ok" : "warn";

  const timeStr = React.useMemo(() => {
    const d = new Date(now);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }, [now]);

  const ping = React.useMemo(() => {
    const t = (now / 1000) % 10;
    const v = 22 + Math.sin(t) * 7 + Math.cos(t * 1.8) * 5;
    return Math.round(clamp(v, 10, 45));
  }, [now]);

  return (
    <>
      <style>
        {`
          @keyframes statusDockIn {
            from {
              opacity: 0;
              transform: translateY(-8px) scale(0.985);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes dockFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-2px); }
          }

          @keyframes dockShimmer {
            0% { transform: translateX(-130%); opacity: 0; }
            20% { opacity: 0.35; }
            80% { opacity: 0.25; }
            100% { transform: translateX(130%); opacity: 0; }
          }
        `}
      </style>

      <div
        className={cn(
          "fixed z-30 right-4 top-[60px] xl:right-5",
          "flex items-start justify-end"
        )}
      >
        {collapsed ? (
          <div
            className={cn(
              "animate-[statusDockIn_.35s_ease-out_both]",
              !reduceMotion && "animate-[statusDockIn_.35s_ease-out_both,dockFloat_7s_ease-in-out_infinite]"
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border border-white/[0.08]",
                "bg-gradient-to-b from-slate-950/80 via-slate-950/55 to-slate-950/30",
                "backdrop-blur-xl shadow-[0_18px_70px_rgba(0,0,0,0.40)]",
                "p-2.5"
              )}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
              <div className="flex flex-col items-center gap-2">
                <DockToggleButton
                  collapsed
                  onClick={() => setManualCollapsed(false)}
                />

                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl px-3 py-2",
                    "border border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                  )}
                  title="Backend OK"
                >
                  <PulseDot tone="ok" />
                  <span className="text-xs font-semibold">OK</span>
                </div>

                <div
                  className={cn(
                    "inline-flex items-center justify-center h-10 w-10 rounded-2xl",
                    "border border-white/[0.08] bg-white/[0.04] text-white/75"
                  )}
                  title={`Пользователь: ${user?.login ?? "Guest"}`}
                >
                  <UserIcon className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "relative overflow-hidden rounded-3xl border border-white/[0.08]",
              "bg-gradient-to-b from-slate-950/80 via-slate-950/55 to-slate-950/30",
              "backdrop-blur-xl shadow-[0_18px_70px_rgba(0,0,0,0.40)]",
              "w-[250px] sm:w-[280px] xl:w-[300px]",
              "animate-[statusDockIn_.45s_ease-out_both]",
              !reduceMotion && "animate-[statusDockIn_.45s_ease-out_both,dockFloat_7s_ease-in-out_infinite]"
            )}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-indigo-500/10 blur-3xl" />

            {!reduceMotion && (
              <div
                className="pointer-events-none absolute top-0 h-full w-20 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                style={{ animation: "dockShimmer 5.5s linear infinite" }}
              />
            )}

            <div className="p-3">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] tracking-wide text-white/40">runtime</div>
                  <div className="text-sm font-semibold text-white/88">System status</div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-[10px] text-white/35">live</div>
                  <DockToggleButton
                    collapsed={false}
                    onClick={() => setManualCollapsed(true)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <MiniCard
                  label="Backend"
                  value="Backend OK"
                  tone={backendTone}
                  accent
                  delay={0}
                  icon={<PulseDot tone={backendTone} />}
                />

                <MiniCard
                  label="Version"
                  value="v1.0.0"
                  delay={40}
                  icon={<ShieldCheck className="h-4 w-4" />}
                />

                <MiniCard
                  label="Uptime"
                  value={uptime}
                  delay={80}
                  icon={<AnimatedBolt />}
                />

                <MiniCard
                  label="Time"
                  value={timeStr}
                  delay={120}
                  icon={<Clock3 className="h-4 w-4" />}
                />

                <MiniCard
                  label="Ping"
                  value={`${ping}ms`}
                  delay={160}
                  icon={<Gauge className="h-4 w-4" />}
                />

                <MiniCard
                  label="Mode"
                  value={user?.role === "admin" ? "Admin" : "Viewer"}
                  tone={secureTone}
                  accent={user?.role === "admin"}
                  delay={200}
                  icon={<Server className="h-4 w-4" />}
                />

                <div className="sm:col-span-2">
                  <MiniCard
                    label="User"
                    value={user?.login ?? "Guest"}
                    delay={240}
                    icon={<UserIcon className="h-4 w-4" />}
                  />
                </div>
              </div>

              {isNarrow && (
                <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-amber-300/15 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90">
                  <ChevronRight className="h-3.5 w-3.5" />
                  Узкое окно: панель лучше держать свернутой.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}