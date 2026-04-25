import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, ChevronDown, Copy, KeyRound, Monitor, X } from "lucide-react";
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
    if (status === "blocked") return "Blocked";
    return "Expired";
}

function statusClass(status: ClientLicenseStatus) {
    if (status === "active") return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    if (status === "blocked") return "border-rose-400/20 bg-rose-500/10 text-rose-200";
    return "border-amber-400/20 bg-amber-500/10 text-amber-200";
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
                    "absolute left-1/2 top-1/2 w-[min(980px,calc(100vw-24px))] max-h-[calc(100vh-24px)]",
                    "-translate-x-1/2 -translate-y-1/2 overflow-hidden",
                    "rounded-[28px] border border-white/10",
                    "bg-gradient-to-b from-slate-950/95 via-slate-950/85 to-slate-950/70",
                    "shadow-[0_30px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl"
                )}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />

                <div className="relative max-h-[calc(100vh-24px)] overflow-y-auto p-5">
                    <div className="flex items-start gap-3">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
                            <KeyRound className="h-5 w-5 text-cyan-200" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="text-xs text-white/50">License details</div>
                            <div className="mt-1 truncate text-xl font-semibold text-white/90">
                                {row.product_name}
                            </div>

                            <div className="mt-2 flex min-w-0 items-center gap-2">
                                <code className="truncate rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/70">
                                    {row.license_key}
                                </code>

                                <button
                                    type="button"
                                    onClick={() => onCopyKey(row.license_key)}
                                    className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
                                    title="Скопировать ключ"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
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

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="text-[11px] text-white/40">Статус</div>
                            <div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs ${statusClass(row.status)}`}>
                                {statusText(row.status)}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="text-[11px] text-white/40">Активации</div>
                            <div className="mt-1 text-xl font-semibold text-white">
                                {activeCount}
                                <span className="text-white/35"> / {row.max_activations}</span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="text-[11px] text-white/40">Срок</div>
                            <div className="mt-1 text-xl font-semibold text-white">{fmtDate(row.expires_at)}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                            <div className="text-[11px] text-white/40">Создан</div>
                            <div className="mt-1 text-xl font-semibold text-white">{fmtDate(row.created_at)}</div>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                        <Card className="p-4">
                            <div className="mb-3 text-sm font-semibold text-white">Настройки ключа</div>

                            <div className="space-y-3">
                                <div>
                                    <div className="mb-1 text-xs text-white/45">Продукт</div>
                                    <input
                                        value={productName}
                                        disabled={!isAdmin}
                                        onChange={(e) => setProductName(e.target.value)}
                                        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none disabled:opacity-60"
                                    />
                                </div>

                                <div>
                                    <div className="mb-1 text-xs text-white/45">Клиент</div>
                                    <input
                                        value={customerName}
                                        disabled={!isAdmin}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        className="w-full min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none disabled:opacity-60"
                                    />
                                </div>

                                <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr_0.8fr]">
                                    <div>
                                        <div className="mb-1 text-xs text-white/45">Статус</div>
                                        <div className="relative">
                                            <button
                                                ref={statusBtnRef}
                                                type="button"
                                                disabled={!isAdmin}
                                                onClick={() => setStatusOpen((v) => !v)}
                                                className={cn(
                                                    "flex w-full items-center justify-between gap-2 rounded-2xl",
                                                    "border border-white/10 bg-white/[0.03] px-3 py-2",
                                                    "text-sm text-white outline-none transition",
                                                    "hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                                                )}
                                            >
                                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(status)}`}>
                                                    {statusText(status)}
                                                </span>
                                                <ChevronDown className="h-4 w-4 text-white/45" />
                                            </button>

                                            <Dropdown
                                                open={statusOpen}
                                                onClose={() => setStatusOpen(false)}
                                                anchorRef={statusBtnRef}
                                                width={220}
                                                align="start"
                                            >
                                                <div className="p-1.5">
                                                    {statusOptions.map((x) => (
                                                        <button
                                                            key={x}
                                                            type="button"
                                                            onClick={() => {
                                                                setStatus(x);
                                                                setStatusOpen(false);
                                                            }}
                                                            className={cn(
                                                                "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2",
                                                                "text-left text-sm transition",
                                                                x === status
                                                                    ? "bg-cyan-500/10 text-cyan-100"
                                                                    : "text-white/75 hover:bg-white/[0.06] hover:text-white"
                                                            )}
                                                        >
                                                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${statusClass(x)}`}>
                                                                {statusText(x)}
                                                            </span>
                                                            {x === status && <span className="text-xs text-cyan-200">selected</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </Dropdown>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="mb-1 text-xs text-white/45">Срок</div>
                                        <input
                                            type="date"
                                            value={expiresAt}
                                            disabled={!isAdmin}
                                            onChange={(e) => setExpiresAt(e.target.value)}
                                            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none disabled:opacity-60"
                                        />
                                    </div>

                                    <div>
                                        <div className="mb-1 text-xs text-white/45">Лимит</div>
                                        <input
                                            type="number"
                                            min={1}
                                            value={maxActivations}
                                            disabled={!isAdmin}
                                            onChange={(e) => setMaxActivations(Number(e.target.value) || 1)}
                                            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none disabled:opacity-60"
                                        />
                                    </div>
                                </div>

                                {isAdmin && (
                                    <div className="flex justify-end">
                                        <Button
                                            size="sm"
                                            disabled={saving}
                                            onClick={() =>
                                                onSave({
                                                    product_name: productName.trim(),
                                                    customer_name: customerName.trim(),
                                                    status,
                                                    expires_at: expiresAt,
                                                    max_activations: Math.max(1, Number(maxActivations) || 1),
                                                })
                                            }
                                        >
                                            {saving ? "Saving…" : "Сохранить"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>

                        <div className="space-y-4">
                            <Card className="p-4">
                                <div className="mb-3 text-sm font-semibold text-white">
                                    Симуляция клиента
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                    <input
                                        value={testDeviceId}
                                        onChange={(e) => setTestDeviceId(e.target.value)}
                                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
                                        placeholder="device_id"
                                    />

                                    <input
                                        value={testDeviceName}
                                        onChange={(e) => setTestDeviceName(e.target.value)}
                                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none"
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
                                        Activate
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
                                        Check
                                    </Button>
                                </div>

                                {testResult && (
                                    <div
                                        className={cn(
                                            "mt-3 rounded-2xl border px-3 py-2 text-xs",
                                            testResult.valid
                                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                                                : "border-rose-400/20 bg-rose-500/10 text-rose-100"
                                        )}
                                    >
                                        {testResult.valid
                                            ? `valid: true · activation_id: ${testResult.activation_id}`
                                            : `valid: false · reason: ${testResult.reason}`}
                                    </div>
                                )}
                            </Card>
                            <Card className="p-4">
                                <div className="mb-3 flex items-center gap-2">
                                    <Monitor className="h-4 w-4 text-cyan-200" />
                                    <div className="text-sm font-semibold text-white">Устройства</div>
                                </div>

                                {activations.length === 0 ? (
                                    <div className="text-sm text-white/45">У этой лицензии пока нет устройств.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {activations.map((x) => (
                                            <div key={x.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate font-mono text-xs text-white">{x.device_id}</div>
                                                        <div className="mt-1 text-xs text-white/45">
                                                            {x.device_name || "Без имени"} · last check: {fmtDate(x.last_check_at)}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/55">
                                                            {x.status}
                                                        </span>

                                                        {isAdmin && x.status === "active" && (
                                                            <Button variant="ghost" size="sm" onClick={() => onDeactivateDevice(x.device_id)}>
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
                                    <Activity className="h-4 w-4 text-violet-200" />
                                    <div className="text-sm font-semibold text-white">Журнал событий</div>
                                </div>

                                {events.length === 0 ? (
                                    <div className="text-sm text-white/45">Событий пока нет.</div>
                                ) : (
                                    <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                                        {events.map((x) => (
                                            <div key={x.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-xs font-semibold text-white">{x.event_type}</div>
                                                    <div className="text-[11px] text-white/35">{fmtDate(x.created_at)}</div>
                                                </div>
                                                <div className="mt-1 text-xs text-white/45">
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