import React, { useEffect, useMemo, useRef } from "react";
import { X, KeyRound, AlertTriangle } from "lucide-react";

import { Button } from "../../Button";
import type { LicenseRow } from "../../../api";

export type Draft = {
  id: string;
  product: string;
  vendor: string;
  license_type: LicenseRow["license_type"];
  assignment_type: LicenseRow["assignment_type"];
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
  if (d < 0) return `истекла ${Math.abs(d)} дн. назад`;
  if (d === 0) return "истекает сегодня";
  return `через ${d} дн.`;
}

export function makeEmptyDraft(): Draft {
  const id = `lic_${Math.random().toString(16).slice(2)}_${Date.now()}`;
  return {
    id,
    product: "",
    vendor: "",
    license_type: "subscription",
    assignment_type: "per_install",
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
    assignment_type: r.assignment_type ?? "per_install",
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
    assignment_type: d.assignment_type,
    seats_total: Math.max(0, safeNum(d.seats_total)),
    seats_used: Math.max(0, safeNum(d.seats_used)),
    starts_at: d.starts_at || undefined,
    expires_at: d.expires_at || undefined,
    note: d.note.trim() || undefined,
  };
}

export function validateDraft(d: Draft): string | null {
  if (!d.product.trim()) return "Название продукта обязательно.";
  if (safeNum(d.seats_total) < 0) return "Общее количество мест не может быть отрицательным.";
  if (safeNum(d.seats_used) < 0) return "Используемые места не могут быть отрицательными.";
  if (d.starts_at && !/^\d{4}-\d{2}-\d{2}$/.test(d.starts_at)) return "Дата начала должна быть в формате YYYY-MM-DD.";
  if (d.expires_at && !/^\d{4}-\d{2}-\d{2}$/.test(d.expires_at)) return "Дата окончания должна быть в формате YYYY-MM-DD.";

  if (d.starts_at && d.expires_at) {
    const s = Date.parse(d.starts_at);
    const e = Date.parse(d.expires_at);
    if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
      return "Дата окончания не может быть раньше даты начала.";
    }
  }

  return null;
}

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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-100";

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

  useEffect(() => {
    if (!open) return;

    const onDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      onClose();
    };

    window.addEventListener("pointerdown", onDown, { capture: true });
    return () =>
      window.removeEventListener("pointerdown", onDown, { capture: true } as any);
  }, [open, onClose]);

  const expiresInfo = useMemo(
    () => expiresHint(draft.expires_at),
    [draft.expires_at]
  );

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-slate-950/45 backdrop-blur-[2px]" aria-hidden />

      <div className="fixed inset-0 z-[310] grid place-items-center p-4" role="dialog" aria-modal="true">
        <div
          ref={rootRef}
          className="relative w-full max-w-[760px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.24)]"
        >
          <div className="flex items-start gap-4 border-b border-slate-200 px-5 py-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <KeyRound className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {isEdit ? "Редактирование" : "Добавление"}
              </div>

              <div className="mt-1 text-xl font-semibold text-slate-950">
                Запись реестра лицензий
              </div>

              <div className="mt-1 text-sm leading-6 text-slate-600">
                Заполните продукт, тип лицензии, количество мест и сроки действия.
              </div>
            </div>

            <button
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
              onClick={onClose}
              title="Закрыть"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-140px)] overflow-y-auto bg-slate-100 p-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Продукт" hint="Название программного продукта">
                  <input
                    value={draft.product}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, product: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="JetBrains All Products Pack"
                  />
                </Field>

                <Field label="Производитель" hint="Название производителя продукта">
                  <input
                    value={draft.vendor}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, vendor: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="JetBrains"
                  />
                </Field>

                <Field label="Коммерческий тип" hint="subscription / perpetual / trial">
                  <select
                    value={draft.license_type}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        license_type: e.target.value as any,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="subscription">subscription</option>
                    <option value="perpetual">perpetual</option>
                    <option value="trial">trial</option>
                  </select>
                </Field>

                <Field
                  label="Тип назначения"
                  hint="Как считать потребность: per_install / per_user / concurrent"
                >
                  <select
                    value={draft.assignment_type}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        assignment_type:
                          e.target.value as LicenseRow["assignment_type"],
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="per_install">per_install</option>
                    <option value="per_user">per_user</option>
                    <option value="concurrent">concurrent</option>
                  </select>
                </Field>

                <Field label="Места" hint="Использовано / всего">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={draft.seats_used}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          seats_used: safeNum(e.target.value),
                        }))
                      }
                      className={inputClass}
                      placeholder="Использовано"
                    />

                    <input
                      type="number"
                      value={draft.seats_total}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          seats_total: safeNum(e.target.value),
                        }))
                      }
                      className={inputClass}
                      placeholder="Всего"
                    />
                  </div>
                </Field>

                <Field label="Дата начала" hint="YYYY-MM-DD">
                  <input
                    value={draft.starts_at}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, starts_at: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="2026-01-04"
                  />
                </Field>

                <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field
                    label="Дата окончания"
                    hint={`YYYY-MM-DD${expiresInfo ? ` · ${expiresInfo}` : ""}`}
                  >
                    <input
                      value={draft.expires_at}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, expires_at: e.target.value }))
                      }
                      className={inputClass}
                      placeholder="2026-02-01"
                    />
                  </Field>

                  <div className="hidden md:block" />
                </div>

                <div className="md:col-span-2">
                  <Field label="Примечание" hint="Пояснение риска или комментарий администратора">
                    <textarea
                      value={draft.note}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, note: e.target.value }))
                      }
                      className="min-h-[90px] w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-100"
                      placeholder="Например: дефицит мест — докупить 5 лицензий, срок истекает через 10 дней."
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <AlertTriangle className="h-4 w-4 text-slate-400" />
                Продукт обязателен. Даты — YYYY-MM-DD. Дата окончания не раньше даты начала.
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                  Отмена
                </Button>

                <Button size="sm" onClick={onSave} disabled={saving}>
                  {saving ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}