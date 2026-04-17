import { cn } from "../../ui/cn/cn";
import type { LicenseRow } from "../../api";
import type { ExpiresFmt, SortDir, SortKey, Tone } from "./types";

export function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseDateDays(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return null;
  return (t - Date.now()) / (1000 * 60 * 60 * 24);
}

export function toneFromSeats(used: number, total: number): Tone {
  if (used > total) return "bad";
  if (total > 0 && used / total >= 0.9) return "warn";
  return "ok";
}

export function toneFromExpires(expiresAt?: string | null): Tone {
  const days = parseDateDays(expiresAt);
  if (days == null) return "ok";
  if (days < 0) return "bad";
  if (days <= 14) return "warn";
  return "ok";
}

export function statusTone(row: LicenseRow): Tone {
  const seats = toneFromSeats(safeNum(row.seats_used), safeNum(row.seats_total));
  const exp = toneFromExpires(row.expires_at ?? null);
  if (seats === "bad" || exp === "bad") return "bad";
  if (seats === "warn" || exp === "warn") return "warn";
  return "ok";
}

export function pill(t: Tone) {
  return cn(
    "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border",
    t === "bad"
      ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
      : t === "warn"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : t === "ok"
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          : "border-white/10 bg-white/[0.03] text-white/70"
  );
}

export function nextDir(d: SortDir): SortDir {
  return d === "desc" ? "asc" : "desc";
}

export function formatExpires(expiresAt?: string | null): ExpiresFmt {
  if (!expiresAt) return { text: "—", hint: "", tone: "ok" };

  const days = parseDateDays(expiresAt);
  if (days == null) return { text: expiresAt, hint: "", tone: "ok" };

  const d = Math.round(days);
  if (d < 0) return { text: expiresAt, hint: `expired ${Math.abs(d)}d ago`, tone: "bad" };
  if (d === 0) return { text: expiresAt, hint: "expires today", tone: "warn" };
  if (d <= 14) return { text: expiresAt, hint: `in ${d}d`, tone: "warn" };
  return { text: expiresAt, hint: `in ${d}d`, tone: "ok" };
}

function sortValue(x: LicenseRow, key: SortKey) {
  if (key === "product") return String(x.product ?? "").toLowerCase();
  if (key === "vendor") return String(x.vendor ?? "").toLowerCase();
  if (key === "type") return String(x.license_type ?? "").toLowerCase();
  if (key === "seats") {
    const used = safeNum(x.seats_used);
    const total = Math.max(1, safeNum(x.seats_total));
    return (used / total) * 1000;
  }
  if (key === "expires") return parseDateDays(x.expires_at ?? null) ?? 10_000;

  const t = statusTone(x);
  return t === "bad" ? 3 : t === "warn" ? 2 : 1;
}

export function cmp(key: SortKey, dir: SortDir) {
  const mul = dir === "asc" ? 1 : -1;
  return (a: LicenseRow, b: LicenseRow) => {
    const av = sortValue(a, key) as any;
    const bv = sortValue(b, key) as any;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
    return String(av).localeCompare(String(bv)) * mul;
  };
}
