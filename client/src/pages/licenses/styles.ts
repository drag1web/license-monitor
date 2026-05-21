import { cn } from "../../ui/cn/cn";
import type { Tone } from "./types";

export const S = {
  page: "space-y-6",

  hero: cn("rounded-xl border border-slate-200 bg-white p-5 shadow-sm"),

  heroTopLine: "hidden",
  heroBlobL: "hidden",
  heroBlobR: "hidden",
  heroNoise: "hidden",

  titleGrad: "text-slate-950",
  subtitle: "max-w-[90ch] text-sm leading-6 text-slate-600",

  toolbar: cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm"),

  searchBox: cn(
    "flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2",
    "focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-slate-100"
  ),

  chip: (active: boolean) =>
    cn(
      "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
      active
        ? "border-slate-900 bg-slate-900 text-white"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
    ),

  miniStat: (t: Tone) =>
    cn(
      "rounded-xl border bg-white px-4 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
      t === "bad"
        ? "border-red-200 text-red-700"
        : t === "warn"
          ? "border-amber-200 text-amber-700"
          : t === "ok"
            ? "border-emerald-200 text-emerald-700"
            : "border-slate-200 text-slate-950"
    ),

  tableCard: cn(
    "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
  ),

  rowShine: "",

  productBtn:
    "text-left font-semibold text-slate-900 hover:text-blue-600 hover:underline underline-offset-4",

  tinyBtn:
    "grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950",
};