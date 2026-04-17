import React from "react";
import {
  Cloud,
  Cpu,
  Dot,
  Globe,
  ShieldCheck,
  User as UserIcon,
  Hammer,
  Activity,
} from "lucide-react";
import { cn } from "../ui/cn/cn";

type StatusTone = "ok" | "warn" | "bad";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function useNow(tickMs = 1000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

function useUptime(t0 = Date.now()) {
  const now = useNow(1000);
  const sec = Math.floor((now - t0) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function useReduceMotion() {
  const [rm, setRm] = React.useState(false);
  React.useEffect(() => {
    const root = document.documentElement;
    const update = () => setRm(root.classList.contains("reduce-motion"));
    update();

    const obs = new MutationObserver(update);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return rm;
}

function Badge({
  children,
  tone = "ok",
  icon,
  title,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  icon?: React.ReactNode;
  title?: string;
}) {
  const toneCls =
    tone === "ok"
      ? "border-emerald-300/18 text-emerald-100/90 bg-emerald-500/10"
      : tone === "warn"
      ? "border-amber-300/18 text-amber-100/90 bg-amber-500/10"
      : "border-rose-300/18 text-rose-100/90 bg-rose-500/10";

  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-2.5 py-1",
        "border",
        "text-[11px] font-semibold tracking-wide",
        "shadow-[0_10px_30px_rgba(0,0,0,0.18)]",
        toneCls
      )}
    >
      {icon}
      <span className="leading-none">{children}</span>
    </span>
  );
}

function SoftChip({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-2.5 py-1",
        "border border-[rgba(var(--fg),0.10)]",
        "bg-[rgba(var(--card),0.08)]",
        "text-[11px] font-semibold",
        "text-[rgba(var(--fg),0.70)]",
        "hover:bg-[rgba(var(--card),0.12)] transition"
      )}
    >
      {icon}
      <span className="leading-none">{children}</span>
    </span>
  );
}

function PulseDot({ tone = "ok" }: { tone?: StatusTone }) {
  const reduceMotion = useReduceMotion();

  const base =
    tone === "ok"
      ? "bg-emerald-300/85 shadow-[0_0_14px_rgba(52,211,153,0.35)]"
      : tone === "warn"
      ? "bg-amber-300/85 shadow-[0_0_14px_rgba(251,191,36,0.35)]"
      : "bg-rose-300/85 shadow-[0_0_14px_rgba(244,63,94,0.35)]";

  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={cn("h-1.5 w-1.5 rounded-full", base)} />
      {!reduceMotion && (
        <span
          className={cn(
            "absolute h-4 w-4 rounded-full",
            base,
            "opacity-20 animate-ping"
          )}
        />
      )}
    </span>
  );
}

function Separator() {
  return <span className="h-4 w-px bg-[rgba(var(--fg),0.12)]" />;
}

export function StatusBar({ user }: { user?: { login: string } }) {
  // You can wire these to real signals later:
  const backend: StatusTone = "ok";
  const secureMode: StatusTone = "ok";

  // optional: show DEV when any dev switch is enabled
  const showDev =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dev");

  const startedAt = React.useMemo(() => Date.now(), []);
  const uptime = useUptime(startedAt);
  const now = useNow(1000);

  const timeStr = React.useMemo(() => {
    const d = new Date(now);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }, [now]);

  // Fake ping for “premium vibe” (replace with real ping later)
  const ping = React.useMemo(() => {
    const t = (now / 1000) % 10;
    const v = 24 + Math.sin(t) * 10 + Math.cos(t * 1.7) * 6; // 8..40-ish
    return Math.round(clamp(v, 8, 65));
  }, [now]);

  return (
    <div
      className={cn(
        "relative",
        "h-9 px-4",
        "flex items-center justify-between",
        "select-none",
        // theme-aware glass:
        "border-t border-[rgba(var(--fg),0.10)]",
        "bg-gradient-to-b from-[rgba(var(--card),0.10)] via-[rgba(var(--card),0.07)] to-[rgba(var(--card),0.05)]",
        "backdrop-blur-xl",
        "shadow-[0_-10px_40px_rgba(0,0,0,0.12)]"
      )}
    >
      {/* top glow line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />

      {/* subtle blobs */}
      <div className="pointer-events-none absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* LEFT */}
      <div className="relative flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-wide text-[rgba(var(--fg),0.78)]">
            License Monitor
          </span>

          <SoftChip
            icon={<Dot className="h-3.5 w-3.5 opacity-70" />}
            title="Build version"
          >
            v1.0.0
          </SoftChip>

          {showDev && (
            <Badge
              tone="warn"
              icon={<Hammer className="h-3.5 w-3.5" />}
              title="Developer mode enabled"
            >
              DEV
            </Badge>
          )}
        </div>

        <Separator />

        <SoftChip icon={<Activity className="h-3.5 w-3.5 opacity-70" />} title="App uptime">
          {uptime}
        </SoftChip>

        <SoftChip icon={<Globe className="h-3.5 w-3.5 opacity-70" />} title="Local time">
          {timeStr}
        </SoftChip>
      </div>

      {/* RIGHT */}
      <div className="relative flex items-center gap-2">
        <Badge
          tone={backend}
          icon={<PulseDot tone={backend} />}
          title="Backend health"
        >
          Backend {backend === "ok" ? "OK" : backend === "warn" ? "WARN" : "DOWN"}
        </Badge>

        <SoftChip icon={<Cloud className="h-3.5 w-3.5 opacity-70" />} title="Ping (ms)">
          {ping}ms
        </SoftChip>

        <SoftChip
          icon={<ShieldCheck className="h-3.5 w-3.5 opacity-70" />}
          title="Security status"
        >
          Secure
        </SoftChip>

        {user ? (
          <SoftChip
            icon={<UserIcon className="h-3.5 w-3.5 opacity-70" />}
            title="Signed-in user"
          >
            {user.login}
          </SoftChip>
        ) : (
          <SoftChip icon={<Cpu className="h-3.5 w-3.5 opacity-70" />} title="Session">
            Guest
          </SoftChip>
        )}
      </div>
    </div>
  );
}
