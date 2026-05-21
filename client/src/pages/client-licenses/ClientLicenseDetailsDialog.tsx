import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ChevronDown,
  Copy,
  KeyRound,
  Monitor,
  Play,
  X,
} from "lucide-react";
import { Dropdown } from "../../components/Dropdown";

import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn/cn";
import type {
  ClientLicenseRow,
  ClientLicenseStatus,
  LicenseActivationRow,
  LicenseEventRow,
  LicenseValidationResponse,
} from "../../api";

const statusOptions: ClientLicenseStatus[] = ["active", "blocked", "expired"];

function statusText(status: ClientLicenseStatus) {
  if (status === "active") return "Активна";
  if (status === "blocked") return "Заблокирована";
  return "Истекла";
}

function statusClass(status: ClientLicenseStatus) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  return v.slice(0, 10);
}

type SavePatch = Partial<{
  status: ClientLicenseStatus;
  expires_at: string;
  max_activations: number;
  product_name: string;
  customer_name: string;
}>;

type Props = {
  open: boolean;
  row: ClientLicenseRow;
  isAdmin: boolean;
  activations: LicenseActivationRow[];
  events: LicenseEventRow[];
  saving: boolean;
  onClose: () => void;
  onCopyKey: (key: string) => void | Promise<void>;
  onDeactivateDevice: (deviceId: string) => void | Promise<void>;
  onSave: (patch: SavePatch) => void | Promise<void>;
  onActivateTestDevice: (input: {
    license_key: string;
    device_id: string;
    device_name?: string;
  }) => Promise<LicenseValidationResponse>;
  onCheckTestDevice: (input: {
    license_key: string;
    device_id: string;
  }) => Promise<LicenseValidationResponse>;
};

function InfoBox({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-950">
        {children ?? value ?? "—"}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-medium text-slate-500">{children}</div>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none",
        "placeholder:text-slate-400 focus:border-slate-600 focus:ring-2 focus:ring-slate-100",
        "disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-80",
        props.className
      )}
    />
  );
}

export function ClientLicenseDetailsDialog({
  open,
  row,
  isAdmin,
  activations,
  events,
  saving,
  onClose,
  onCopyKey,
  onDeactivateDevice,
  onSave,
  onActivateTestDevice,
  onCheckTestDevice,
}: Props) {
  const [status, setStatus] = useState<ClientLicenseStatus>(row.status);
  const [expiresAt, setExpiresAt] = useState(row.expires_at ?? "");
  const [maxActivations, setMaxActivations] = useState(row.max_activations);
  const [productName, setProductName] = useState(row.product_name);
  const [customerName, setCustomerName] = useState(row.customer_name);

  const statusBtnRef = useRef<HTMLButtonElement | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  const [testDeviceId, setTestDeviceId] = useState("TEST-PC-01");
  const [testDeviceName, setTestDeviceName] = useState("Test device");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<LicenseValidationResponse | null>(null);

  useEffect(() => {
    if (!open) return;

    setStatus(row.status);
    setExpiresAt(row.expires_at ?? "");
    setMaxActivations(row.max_activations);
    setProductName(row.product_name);
    setCustomerName(row.customer_name);

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
  }, [open, row, onClose]);

  if (!open) return null;

  const activeCount = activations.filter((x) => x.status === "active").length;

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
          "absolute left-1/2 top-1/2 w-[min(1080px,calc(100vw-24px))] max-h-[calc(100vh-24px)]",
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
              Детали клиентского ключа
            </div>

            <div className="mt-1 truncate text-xl font-semibold text-slate-950">
              {row.product_name}
            </div>

            <div className="mt-2 flex min-w-0 items-center gap-2">
              <code className="truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
                {row.license_key}
              </code>

              <button
                type="button"
                onClick={() => onCopyKey(row.license_key)}
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                title="Скопировать ключ"
              >
                <Copy className="h-4 w-4" />
              </button>
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

        <div className="max-h-[calc(100vh-116px)] overflow-y-auto bg-slate-100 p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <InfoBox label="Статус">
              <span className={cn("inline-flex rounded-md border px-2 py-1 text-sm font-medium", statusClass(status))}>
                {statusText(status)}
              </span>
            </InfoBox>

            <InfoBox label="Активации">
              {activeCount}
              <span className="text-slate-400"> / {row.max_activations}</span>
            </InfoBox>

            <InfoBox label="Срок действия" value={fmtDate(row.expires_at)} />
            <InfoBox label="Создан" value={fmtDate(row.created_at)} />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-4">
              <div className="mb-4 text-sm font-semibold text-slate-950">
                Настройки ключа
              </div>

              <div className="space-y-3">
                <div>
                  <FieldLabel>Продукт</FieldLabel>
                  <TextInput
                    value={productName}
                    disabled={!isAdmin}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>

                <div>
                  <FieldLabel>Клиент</FieldLabel>
                  <TextInput
                    value={customerName}
                    disabled={!isAdmin}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr_0.8fr]">
                  <div>
                    <FieldLabel>Статус</FieldLabel>
                    <div className="relative">
                      <button
                        ref={statusBtnRef}
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setStatusOpen((v) => !v)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
                          "hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                        )}
                      >
                        <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", statusClass(status))}>
                          {statusText(status)}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </button>

                      <Dropdown
                        open={statusOpen}
                        onClose={() => setStatusOpen(false)}
                        anchorRef={statusBtnRef}
                        width={220}
                        align="start"
                      >
                        <div className="bg-white p-1.5">
                          {statusOptions.map((x) => (
                            <button
                              key={x}
                              type="button"
                              onClick={() => {
                                setStatus(x);
                                setStatusOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                                x === status
                                  ? "bg-slate-100 text-slate-950"
                                  : "text-slate-700 hover:bg-slate-50"
                              )}
                            >
                              <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", statusClass(x))}>
                                {statusText(x)}
                              </span>
                              {x === status && <span className="text-xs text-slate-500">выбрано</span>}
                            </button>
                          ))}
                        </div>
                      </Dropdown>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Срок действия</FieldLabel>
                    <TextInput
                      type="date"
                      value={expiresAt}
                      disabled={!isAdmin}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>

                  <div>
                    <FieldLabel>Лимит</FieldLabel>
                    <TextInput
                      type="number"
                      min={1}
                      value={maxActivations}
                      disabled={!isAdmin}
                      onChange={(e) => setMaxActivations(Number(e.target.value) || 1)}
                    />
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={async () => {
                        await onSave({
                          product_name: productName.trim(),
                          customer_name: customerName.trim(),
                          status,
                          expires_at: expiresAt,
                          max_activations: Math.max(1, Number(maxActivations) || 1),
                        });
                      }}
                    >
                      {saving ? "Сохранение..." : "Сохранить"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Play className="h-4 w-4 text-slate-500" />
                  <div className="text-sm font-semibold text-slate-950">
                    Симуляция Entitlex
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Проверка того, как клиентское приложение Entitlex будет валидировать ключ.
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <TextInput
                    value={testDeviceId}
                    onChange={(e) => setTestDeviceId(e.target.value)}
                    placeholder="device_id"
                  />

                  <TextInput
                    value={testDeviceName}
                    onChange={(e) => setTestDeviceName(e.target.value)}
                    placeholder="device_name"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={testBusy}
                    onClick={async () => {
                      setTestBusy(true);
                      try {
                        const result = await onActivateTestDevice({
                          license_key: row.license_key,
                          device_id: testDeviceId.trim(),
                          device_name: testDeviceName.trim() || undefined,
                        });
                        setTestResult(result);
                      } finally {
                        setTestBusy(false);
                      }
                    }}
                  >
                    Активировать
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={testBusy}
                    onClick={async () => {
                      setTestBusy(true);
                      try {
                        const result = await onCheckTestDevice({
                          license_key: row.license_key,
                          device_id: testDeviceId.trim(),
                        });
                        setTestResult(result);
                      } finally {
                        setTestBusy(false);
                      }
                    }}
                  >
                    Проверить
                  </Button>
                </div>

                {testResult && (
                  <div
                    className={cn(
                      "mt-3 rounded-lg border px-3 py-2 text-xs",
                      testResult.valid
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    )}
                  >
                    {testResult.valid
                      ? `valid: true · activation_id: ${testResult.activation_id} · expires_at: ${testResult.expires_at ?? "—"}`
                      : `valid: false · reason: ${testResult.reason}`}
                  </div>
                )}
              </Card>

              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-slate-500" />
                  <div className="text-sm font-semibold text-slate-950">Устройства</div>
                </div>

                {activations.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                    У этой лицензии пока нет устройств.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activations.map((x) => (
                      <div key={x.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-xs font-semibold text-slate-900">
                              {x.device_id}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {x.device_name || "Без имени"} · last check: {fmtDate(x.last_check_at)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                              {x.status === "active"
                                ? "Активно"
                                : x.status === "deactivated"
                                  ? "Отключено"
                                  : "Заблокировано"}
                            </span>

                            {isAdmin && x.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDeactivateDevice(x.device_id)}
                              >
                                Отключить
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-500" />
                  <div className="text-sm font-semibold text-slate-950">Журнал событий</div>
                </div>

                {events.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                    Событий пока нет.
                  </div>
                ) : (
                  <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                    {events.map((x) => (
                      <div key={x.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-semibold text-slate-900">
                            {x.event_type}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {fmtDate(x.created_at)}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {x.device_id || "—"} · {x.message || "—"} · {x.ip_address || "ip —"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}