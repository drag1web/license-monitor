import React, { useEffect, useMemo, useRef } from "react";
import { X, KeyRound, AlertTriangle } from "lucide-react";

import { cn } from "../../cn/cn";
import { Button } from "../../Button";
import type { LicenseRow } from "../../../api";

/* ------------------------------------------
 * Draft model
 * ------------------------------------------ */

export type Draft = {
  id: string;
  product: string;
  vendor: string;
  license_type: LicenseRow["license_type"];
  seats_total: number;
  seats_used: number;
  starts_at: string;
  expires_at: string;
  note: string;
};

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseDateDays(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return null;
  return (t - Date.now()) / (1000 * 60 * 60 * 24);
}

function expiresHint(expiresAt?: string) {
  if (!expiresAt) return "";
  const days = parseDateDays(expiresAt);
  if (days == null) return "";
  const d = Math.round(days);
  if (d < 0) return `expired ${Math.abs(d)}d ago`;
  if (d === 0) return "expires today";
  return `in ${d}d`;
}

export function makeEmptyDraft(): Draft {
  const id = `lic_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return {
    id,
    product: "",
    vendor: "",
    license_type: "subscription",
    seats_total: 10,
    seats_used: 0,
    starts_at: "",
    expires_at: "",
    note: "",
  };
}

export function fromRow(r: LicenseRow): Draft {
  return {
    id: r.id,
    product: r.product ?? "",
    vendor: r.vendor ?? "",
    license_type: r.license_type ?? "subscription",
    seats_total: safeNum(r.seats_total),
    seats_used: safeNum(r.seats_used),
    starts_at: r.starts_at ?? "",
    expires_at: r.expires_at ?? "",
    note: r.note ?? "",
  };
}

export function toRow(d: Draft): LicenseRow {
  return {
    id: d.id,
    product: d.product.trim(),
    vendor: d.vendor.trim() || undefined,
    license_type: d.license_type,
    seats_total: Math.max(0, safeNum(d.seats_total)),
    seats_used: Math.max(0, safeNum(d.seats_used)),
    starts_at: d.starts_at || undefined,
    expires_at: d.expires_at || undefined,
    note: d.note.trim() || undefined,
  };
}

export function validateDraft(d: Draft): string | null {
  if (!d.product.trim()) return "Product обязателен.";
  if (safeNum(d.seats_total) < 0) return "seats_total не может быть отрицательным.";
  if (safeNum(d.seats_used) < 0) return "seats_used не может быть отрицательным.";
  if (d.starts_at && !/^\d{4}-\d{2}-\d{2}$/.test(d.starts_at)) return "starts_at должен быть YYYY-MM-DD.";
  if (d.expires_at && !/^\d{4}-\d{2}-\d{2}$/.test(d.expires_at)) return "expires_at должен быть YYYY-MM-DD.";

  if (d.starts_at && d.expires_at) {
    const s = Date.parse(d.starts_at);
    const e = Date.parse(d.expires_at);
    if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
      return "expires_at не может быть раньше starts_at.";
    }
  }

  return null;
}

/* ------------------------------------------
 * Modal helpers
 * ------------------------------------------ */

function useLockBodyScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}

/* ------------------------------------------
 * Styles
 * ------------------------------------------ */

const S = {
  overlay: "fixed inset-0 z-[300] bg-black/55 backdrop-blur-sm",
  wrap: "fixed inset-0 z-[310] grid place-items-center p-4",
  modal: cn(
    "relative w-full max-w-[760px] rounded-3xl border border-white/[0.10] overflow-hidden",
    "bg-gradient-to-b from-slate-950/80 via-slate-950/55 to-slate-950/35",
    "shadow-[0_30px_140px_rgba(0,0,0,0.75)] backdrop-blur-xl"
  ),
  topLine:
    "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent",
  blob:
    "pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl",
  body: "relative p-5",
  fieldCard: cn("rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4"),
  label: "text-sm font-semibold text-white/85",
  hint: "text-[12px] text-white/45 mt-0.5",
  input: cn(
    "w-full rounded-2xl border px-3.5 py-2 text-sm",
    "bg-white/[0.03] border-white/[0.08] text-white/85",
    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
  ),
  textarea: cn(
    "w-full min-h-[90px] rounded-2xl border p-3 text-[12px]",
    "bg-black/20 border-white/[0.10] text-white/85",
    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
  ),
};

/* ------------------------------------------
 * Component
 * ------------------------------------------ */

export function LicenseEditorDialog({
  open,
  isEdit,
  draft,
  setDraft,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  isEdit: boolean;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  useLockBodyScroll(open);
  useEsc(open, onClose);

  const rootRef = useRef<HTMLDivElement | null>(null);

  // close on outside click (but not inside modal)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true } as any);
  }, [open, onClose]);

  const expiresInfo = useMemo(() => expiresHint(draft.expires_at), [draft.expires_at]);

  if (!open) return null;

  return (
    <>
      <div className={S.overlay} aria-hidden />
      <div className={S.wrap} role="dialog" aria-modal="true">
        <div ref={rootRef} className={S.modal}>
          <div className={S.topLine} />
          <div className={S.blob} />

          <div className={S.body}>
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "h-11 w-11 rounded-2xl border border-white/[0.10] bg-white/[0.04] grid place-items-center",
                  "shadow-[0_18px_70px_rgba(34,211,238,0.08)]"
                )}
              >
                <KeyRound className="h-5 w-5 text-cyan-200/85" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-xs text-white/50 tracking-wide">{isEdit ? "Edit" : "Add"}</div>
                <div className="mt-1 text-xl font-semibold tracking-tight text-white/90">License entry</div>
                <div className="mt-1 text-sm text-white/55">
                  Заполни продукт, тип, seats и даты. Всё хранится локально.
                </div>
              </div>

              <button
                className={cn(
                  "h-10 w-10 rounded-2xl border border-white/[0.08] bg-white/[0.03]",
                  "hover:bg-white/[0.06] transition grid place-items-center"
                )}
                onClick={onClose}
                title="Close"
                type="button"
              >
                <X className="h-5 w-5 text-white/70" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={S.fieldCard}>
                <div className={S.label}>Product *</div>
                <div className={S.hint}>Название ПО / продукта</div>
                <input
                  value={draft.product}
                  onChange={(e) => setDraft((d) => ({ ...d, product: e.target.value }))}
                  className={cn(S.input, "mt-2")}
                  placeholder="JetBrains All Products Pack"
                />
              </div>

              <div className={S.fieldCard}>
                <div className={S.label}>Vendor</div>
                <div className={S.hint}>Производитель</div>
                <input
                  value={draft.vendor}
                  onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))}
                  className={cn(S.input, "mt-2")}
                  placeholder="JetBrains"
                />
              </div>

              <div className={S.fieldCard}>
                <div className={S.label}>License type</div>
                <div className={S.hint}>perpetual / subscription / trial</div>
                <select
                  value={draft.license_type}
                  onChange={(e) => setDraft((d) => ({ ...d, license_type: e.target.value as any }))}
                  className={cn(S.input, "mt-2")}
                >
                  <option value="subscription">subscription</option>
                  <option value="perpetual">perpetual</option>
                  <option value="trial">trial</option>
                </select>
              </div>

              <div className={S.fieldCard}>
                <div className={S.label}>Seats</div>
                <div className={S.hint}>used / total</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={draft.seats_used}
                    onChange={(e) => setDraft((d) => ({ ...d, seats_used: safeNum(e.target.value) }))}
                    className={S.input}
                    placeholder="used"
                  />
                  <input
                    type="number"
                    value={draft.seats_total}
                    onChange={(e) => setDraft((d) => ({ ...d, seats_total: safeNum(e.target.value) }))}
                    className={S.input}
                    placeholder="total"
                  />
                </div>
              </div>

              <div className={S.fieldCard}>
                <div className={S.label}>Starts at</div>
                <div className={S.hint}>YYYY-MM-DD (optional)</div>
                <input
                  value={draft.starts_at}
                  onChange={(e) => setDraft((d) => ({ ...d, starts_at: e.target.value }))}
                  className={cn(S.input, "mt-2")}
                  placeholder="2026-01-04"
                />
              </div>

              <div className={S.fieldCard}>
                <div className={S.label}>Expires at</div>
                <div className={S.hint}>YYYY-MM-DD (optional){expiresInfo ? ` • ${expiresInfo}` : ""}</div>
                <input
                  value={draft.expires_at}
                  onChange={(e) => setDraft((d) => ({ ...d, expires_at: e.target.value }))}
                  className={cn(S.input, "mt-2")}
                  placeholder="2026-02-01"
                />
              </div>
            </div>

            <div className={cn(S.fieldCard, "mt-3")}>
              <div className={S.label}>Note</div>
              <div className={S.hint}>Любые пояснения (почему риск / что делать)</div>
              <textarea
                value={draft.note}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                className={cn(S.textarea, "mt-2")}
                placeholder="Например: дефицит seats — докупить 5 лицензий, срок истекает через 10 дней."
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] text-white/45">
                <AlertTriangle className="h-4 w-4 text-white/40" />
                Product обязателен. Даты — YYYY-MM-DD. Expires ≥ Starts.
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>

                <Button variant="primary" size="sm" onClick={onSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
