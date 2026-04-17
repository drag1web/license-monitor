import { cn } from "../../ui/cn/cn";
import type { Tone } from "./types";

export const S = {
    page: "space-y-4",

    hero: cn(
        "relative overflow-hidden rounded-3xl p-5",
        "border border-white/[0.08]",
        "bg-gradient-to-b from-slate-950/70 via-slate-950/45 to-slate-950/25",
        // backdrop-blur-xl лучше оставить, но можно ослабить:
        "backdrop-blur-lg",
        "shadow-[0_18px_60px_rgba(0,0,0,0.50)]"
    ),

    heroTopLine:
        "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent",
    heroBlobL: "pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl",
    heroBlobR: "pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl",
    heroNoise:
        "pointer-events-none absolute inset-0 opacity-[0.055] mix-blend-overlay bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.35),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(34,211,238,0.25),transparent_40%),radial-gradient(circle_at_55%_85%,rgba(99,102,241,0.22),transparent_40%)]",
    titleGrad: "text-transparent bg-clip-text bg-gradient-to-r from-white/90 via-white/70 to-white/50",
    subtitle: "text-sm text-white/55 max-w-[90ch]",

    toolbar: cn(
        "rounded-3xl border border-white/[0.08] bg-white/[0.02]",
        "p-3 md:p-4",
        "shadow-[0_18px_70px_rgba(0,0,0,0.45)]"
    ),

    searchBox: cn(
        "flex items-center gap-2 rounded-2xl border px-3.5 py-2",
        "bg-white/[0.03] border-white/[0.08]",
        "focus-within:border-cyan-200/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.10)]"
    ),

    chip: (active: boolean) =>
        cn(
            "inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border",
            "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25",
            active
                ? "border-cyan-300/25 bg-cyan-500/12 text-cyan-100"
                : "border-white/[0.08] bg-white/[0.03] text-white/75 hover:bg-white/[0.06] hover:text-white/85"
        ),

    miniStat: (t: Tone) =>
        cn(
            "rounded-2xl border px-4 py-3",
            t === "bad"
                ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
                : t === "warn"
                    ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
                    : t === "ok"
                        ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                        : "border-white/10 bg-white/[0.03] text-white/70"
        ),

    tableCard: cn(
        "p-0 rounded-3xl overflow-hidden",
        "border border-white/[0.08] bg-white/[0.02]",
        "shadow-[0_18px_50px_rgba(0,0,0,0.45)]",
        "[contain:paint]"
    ),

    rowShine:
        "relative after:pointer-events-none after:absolute after:inset-0 " +
        "after:opacity-0 hover:after:opacity-100 " +
        "after:transition-opacity after:duration-150 " +
        "after:bg-[radial-gradient(560px_110px_at_50%_0%,rgba(34,211,238,0.08),transparent_60%)]",

    productBtn:
        "text-left font-semibold text-white/90 hover:underline underline-offset-4 decoration-white/20",

    tinyBtn:
        "h-10 w-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] grid place-items-center hover:bg-white/[0.06] transition",
};
