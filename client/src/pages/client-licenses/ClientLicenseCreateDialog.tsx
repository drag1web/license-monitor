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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none",
        "placeholder:text-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-100",
        props.className
      )}
    />
  );
}

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
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute left-1/2 top-1/2 w-[min(720px,calc(100vw-24px))]",
          "-translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl",
          "border border-slate-300 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.24)]"
        )}
      >
        <div className="flex items-start gap-4 border-b border-slate-200 px-5 py-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <KeyRound className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Создание ключа
            </div>

            <div className="mt-1 text-xl font-semibold text-slate-950">
              Клиентская лицензия
            </div>

            <div className="mt-1 text-sm leading-6 text-slate-600">
              Создание серверной проверки лицензии для защищённого клиентского приложения.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-slate-100 p-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Лицензионный ключ" required>
                  <TextInput
                    value={draft.license_key}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, license_key: e.target.value }))
                    }
                    placeholder="LM-XXXX-XXXX-XXXX"
                  />
                </Field>
              </div>

              <Field label="Продукт" required>
                <TextInput
                  value={draft.product_name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, product_name: e.target.value }))
                  }
                  placeholder="Entitlex"
                />
              </Field>

              <Field label="Клиент" required>
                <TextInput
                  value={draft.customer_name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, customer_name: e.target.value }))
                  }
                  placeholder="ООО «Меридиан Инжиниринг»"
                />
              </Field>

              <Field label="Срок действия">
                <TextInput
                  type="date"
                  value={draft.expires_at}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, expires_at: e.target.value }))
                  }
                />
              </Field>

              <Field label="Максимум активаций">
                <TextInput
                  type="number"
                  min={1}
                  value={draft.max_activations}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      max_activations: Number(e.target.value) || 1,
                    }))
                  }
                />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Отмена
            </Button>

            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? "Создание..." : "Создать ключ"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}