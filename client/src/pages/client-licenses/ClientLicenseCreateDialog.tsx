import { useEffect } from "react";
import { createPortal } from "react-dom";
import { KeyRound, X } from "lucide-react";

import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn/cn";
import type { ClientLicenseDraft } from "./types";

type Props = {
  open: boolean;
  draft: ClientLicenseDraft;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  setDraft: React.Dispatch<React.SetStateAction<ClientLicenseDraft>>;
};

export function ClientLicenseCreateDialog({
  open,
  draft,
  saving,
  onClose,
  onSave,
  setDraft,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/60 backdrop-blur-[2px]",
          "bg-[radial-gradient(1200px_600px_at_50%_20%,rgba(0,255,255,0.08),transparent_55%)]"
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute left-1/2 top-1/2 w-[min(760px,calc(100vw-24px))]",
          "-translate-x-1/2 -translate-y-1/2",
          "overflow-hidden rounded-[28px] border border-white/10",
          "bg-gradient-to-b from-slate-950/90 via-slate-950/75 to-slate-950/60",
          "shadow-[0_30px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />

        <div className="relative p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
              <KeyRound className="h-5 w-5 text-cyan-200" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs text-white/50">Create</div>
              <div className="mt-1 text-xl font-semibold text-white/90">
                Клиентский ключ
              </div>
              <div className="mt-1 text-sm text-white/55">
                Создание server-side лицензии для клиентского приложения.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]"
            >
              <X className="h-5 w-5 text-white/70" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4 md:col-span-2">
              <div className="text-sm font-semibold text-white/85">License key *</div>
              <input
                value={draft.license_key}
                onChange={(e) => setDraft((d) => ({ ...d, license_key: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                placeholder="LM-XXXX-XXXX-XXXX"
              />
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white/85">Product *</div>
              <input
                value={draft.product_name}
                onChange={(e) => setDraft((d) => ({ ...d, product_name: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                placeholder="Meridian Client App"
              />
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white/85">Customer *</div>
              <input
                value={draft.customer_name}
                onChange={(e) => setDraft((d) => ({ ...d, customer_name: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                placeholder="Меридиан"
              />
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white/85">Expires at</div>
              <input
                type="date"
                value={draft.expires_at}
                onChange={(e) => setDraft((d) => ({ ...d, expires_at: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
              />
            </div>

            <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white/85">Max activations</div>
              <input
                type="number"
                min={1}
                value={draft.max_activations}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, max_activations: Number(e.target.value) || 1 }))
                }
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : "Create key"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}