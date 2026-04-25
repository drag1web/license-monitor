import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Ban,
    Clock,
    Copy,
    KeyRound,
    Plus,
    RefreshCw,
    ShieldCheck,
} from "lucide-react";

import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useToast } from "../ui/toast";
import { ViewerNotice } from "../components/ViewerNotice";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../ui/cn/cn";

import {
    Table,
    TableCaption,
    TableEmpty,
    TableInner,
    TableScroll,
    TBody,
    Td,
    Th,
    THead,
    Tr,
} from "../ui/Table";

import {
    createClientLicense,
    deactivateClientLicense,
    getClientLicenses,
    getLicenseActivations,
    getLicenseEvents,
    updateClientLicense,
    activateClientLicense,
    checkClientLicense,
    type ClientLicenseRow,
    type ClientLicenseStatus,
    type LicenseActivationRow,
    type LicenseEventRow,
} from "../api";

import { ClientLicenseCreateDialog } from "./client-licenses/ClientLicenseCreateDialog";
import { ClientLicenseDetailsDialog } from "./client-licenses/ClientLicenseDetailsDialog";
import {
    makeClientLicenseDraft,
    type ClientLicenseDraft,
} from "./client-licenses/types";

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

export default function ClientLicenses() {
    const toast = useToast();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [rows, setRows] = useState<ClientLicenseRow[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const [activations, setActivations] = useState<LicenseActivationRow[]>([]);
    const [events, setEvents] = useState<LicenseEventRow[]>([]);

    const [q, setQ] = useState("");

    const [openCreate, setOpenCreate] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const [draft, setDraft] = useState<ClientLicenseDraft>(() =>
        makeClientLicenseDraft()
    );

    const [saving, setSaving] = useState(false);
    const [detailsSaving, setDetailsSaving] = useState(false);

    const selected = useMemo(
        () => rows.find((x) => x.id === selectedId) ?? null,
        [rows, selectedId]
    );

    const stats = useMemo(() => {
        return {
            total: rows.length,
            active: rows.filter((x) => x.status === "active").length,
            blocked: rows.filter((x) => x.status === "blocked").length,
            expired: rows.filter((x) => x.status === "expired").length,
        };
    }, [rows]);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();

        if (!needle) return rows;

        return rows.filter((x) => {
            const hay = `${x.license_key} ${x.product_name} ${x.customer_name} ${x.status}`.toLowerCase();
            return hay.includes(needle);
        });
    }, [rows, q]);

    const load = useCallback(async () => {
        setLoading(true);
        setErr("");

        try {
            const data = await getClientLicenses();
            setRows(data ?? []);

            if (!selectedId && data?.[0]) {
                setSelectedId(data[0].id);
            }
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [selectedId]);

    const loadDetails = useCallback(
        async (id: number) => {
            try {
                const [a, ev] = await Promise.all([
                    getLicenseActivations(id),
                    getLicenseEvents(id),
                ]);

                setActivations(a ?? []);
                setEvents(ev ?? []);
            } catch (e: unknown) {
                toast.push({
                    tone: "error",
                    title: "Ошибка загрузки деталей",
                    message: e instanceof Error ? e.message : String(e),
                });
            }
        },
        [toast]
    );

    useEffect(() => {
        load();
    }, [load]);

    async function copyKey(key: string) {
        await navigator.clipboard.writeText(key);
        toast.push({ tone: "success", title: "Ключ скопирован", message: key });
    }

    async function openDetails(row: ClientLicenseRow) {
        setSelectedId(row.id);
        setDetailsOpen(true);
        await loadDetails(row.id);
    }

    async function createNew() {
        if (!isAdmin) return;

        if (!draft.license_key.trim() || !draft.product_name.trim() || !draft.customer_name.trim()) {
            toast.push({
                tone: "error",
                title: "Проверка",
                message: "Заполни ключ, продукт и клиента.",
            });
            return;
        }

        setSaving(true);

        try {
            const row = await createClientLicense({
                license_key: draft.license_key.trim(),
                product_name: draft.product_name.trim(),
                customer_name: draft.customer_name.trim(),
                expires_at: draft.expires_at || undefined,
                max_activations: Math.max(1, Number(draft.max_activations) || 1),
                status: "active",
            });

            setRows((prev) => [row, ...prev]);
            setSelectedId(row.id);
            setDraft(makeClientLicenseDraft());
            setOpenCreate(false);

            toast.push({
                tone: "success",
                title: "Ключ создан",
                message: `${row.product_name} • ${row.customer_name}`,
            });
        } catch (e: unknown) {
            toast.push({
                tone: "error",
                title: "Создание не удалось",
                message: e instanceof Error ? e.message : String(e),
            });
        } finally {
            setSaving(false);
        }
    }

    async function deactivateDevice(deviceId: string) {
        if (!selected) return;

        try {
            await deactivateClientLicense({
                license_key: selected.license_key,
                device_id: deviceId,
            });

            toast.push({
                tone: "success",
                title: "Устройство отключено",
                message: deviceId,
            });

            await loadDetails(selected.id);
        } catch (e: unknown) {
            toast.push({
                tone: "error",
                title: "Не удалось отключить",
                message: e instanceof Error ? e.message : String(e),
            });
        }
    }

    async function activateTestDevice(input: {
        license_key: string;
        device_id: string;
        device_name?: string;
    }) {
        const result = await activateClientLicense(input);

        toast.push({
            tone: result.valid ? "success" : "error",
            title: result.valid ? "Активация успешна" : "Активация отклонена",
            message: result.valid ? `activation_id: ${result.activation_id}` : result.reason,
        });

        if (selected) {
            await loadDetails(selected.id);
        }

        return result;
    }

    async function checkTestDevice(input: {
        license_key: string;
        device_id: string;
    }) {
        const result = await checkClientLicense(input);

        toast.push({
            tone: result.valid ? "success" : "error",
            title: result.valid ? "Проверка успешна" : "Проверка отклонена",
            message: result.valid ? `activation_id: ${result.activation_id}` : result.reason,
        });

        if (selected) {
            await loadDetails(selected.id);
        }

        return result;
    }

    if (err) {
        return (
            <Card className="p-5">
                <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
                    <div className="text-sm font-semibold text-rose-100">Ошибка</div>
                    <div className="mt-1 text-xs text-rose-200/80 break-words">{err}</div>
                    <div className="mt-3">
                        <Button variant="ghost" size="sm" onClick={load}>
                            Обновить
                        </Button>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <ClientLicenseCreateDialog
                open={openCreate}
                draft={draft}
                setDraft={setDraft}
                saving={saving}
                onClose={() => setOpenCreate(false)}
                onSave={createNew}
            />

            {selected && (
                <ClientLicenseDetailsDialog
                    open={detailsOpen}
                    row={selected}
                    isAdmin={isAdmin}
                    activations={activations}
                    events={events}
                    saving={detailsSaving}
                    onClose={() => setDetailsOpen(false)}
                    onCopyKey={copyKey}
                    onDeactivateDevice={deactivateDevice}
                    onActivateTestDevice={activateTestDevice}
                    onCheckTestDevice={checkTestDevice}
                    onSave={async (patch) => {
                        setDetailsSaving(true);

                        try {
                            const saved = await updateClientLicense(selected.id, patch);

                            setRows((prev) =>
                                prev.map((x) => (x.id === saved.id ? saved : x))
                            );

                            toast.push({
                                tone: "success",
                                title: "Ключ обновлён",
                                message: saved.license_key,
                            });

                            await loadDetails(saved.id);
                        } catch (e: unknown) {
                            toast.push({
                                tone: "error",
                                title: "Не удалось сохранить",
                                message: e instanceof Error ? e.message : String(e),
                            });
                        } finally {
                            setDetailsSaving(false);
                        }
                    }}
                />
            )}

            {!isAdmin && (
                <ViewerNotice message="У вас режим только для просмотра. Управление клиентскими лицензиями доступно только admin." />
            )}

            <Card className="relative overflow-hidden p-5 md:p-6">
                <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

                <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-500/10">
                            <KeyRound className="h-5 w-5 text-cyan-200" />
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-white/55">
                                Server licensing
                            </div>
                            <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
                                Клиентские ключи
                            </div>
                            <div className="mt-2 max-w-2xl text-sm text-white/60">
                                Управление ключами, лимитами активаций, устройствами и журналом server-side проверок.
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" onClick={load}>
                            <RefreshCw className="h-4 w-4" />
                            Обновить
                        </Button>

                        {isAdmin && (
                            <Button
                                onClick={() => {
                                    setDraft(makeClientLicenseDraft());
                                    setOpenCreate(true);
                                }}
                            >
                                <Plus className="h-4 w-4" />
                                Создать ключ
                            </Button>
                        )}
                    </div>
                </div>

                <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="text-[11px] text-white/45">Всего ключей</div>
                        <div className="mt-1 text-2xl font-semibold text-white">{stats.total}</div>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3">
                        <div className="text-[11px] text-emerald-100/60">Активные</div>
                        <div className="mt-1 text-2xl font-semibold text-emerald-100">{stats.active}</div>
                    </div>

                    <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 px-4 py-3">
                        <div className="text-[11px] text-rose-100/60">Blocked</div>
                        <div className="mt-1 text-2xl font-semibold text-rose-100">{stats.blocked}</div>
                    </div>

                    <div className="rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3">
                        <div className="text-[11px] text-amber-100/60">Expired</div>
                        <div className="mt-1 text-2xl font-semibold text-amber-100">{stats.expired}</div>
                    </div>
                </div>
            </Card>

            <Table className="overflow-hidden">
                <TableCaption
                    title="Клиентские лицензии"
                    description={
                        loading
                            ? "Загрузка..."
                            : `Показано: ${filtered.length} / Всего: ${rows.length}`
                    }
                    right={
                        <input
                            className="w-[min(420px,50vw)] rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Поиск по ключу, продукту, клиенту..."
                        />
                    }
                />

                <TableScroll className="max-w-full">
                    <TableInner fixedLayout density="comfortable" className="min-w-[860px]">
                        <colgroup>
                            <col className="w-[250px]" />
                            <col className="w-[190px]" />
                            <col className="w-[160px]" />
                            <col className="w-[130px]" />
                            <col className="w-[115px]" />
                            <col className="w-[120px]" />
                            <col className="w-[115px]" />
                        </colgroup>

                        <THead>
                            <Tr interactive={false}>
                                <Th>Ключ</Th>
                                <Th>Продукт</Th>
                                <Th>Клиент</Th>
                                <Th>Статус</Th>
                                <Th>Срок</Th>
                                <Th>Лимит</Th>
                                <Th>Создан</Th>
                            </Tr>
                        </THead>

                        <TBody>
                            {filtered.map((row) => (
                                <Tr
                                    key={row.id}
                                    onClick={() => openDetails(row)}
                                    className={cn(
                                        "cursor-pointer",
                                        selectedId === row.id && "bg-cyan-500/10"
                                    )}
                                >
                                    <Td>
                                        <div className="flex min-w-0 items-center gap-2">
                                            <div
                                                className="min-w-0 truncate font-mono text-xs text-white"
                                                title={row.license_key}
                                            >
                                                {row.license_key}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyKey(row.license_key);
                                                }}
                                                className="shrink-0 rounded-lg p-1 text-white/35 transition hover:bg-white/10 hover:text-white"
                                                title="Скопировать ключ"
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </Td>

                                    <Td>
                                        <div className="min-w-0">
                                            <div
                                                className="truncate font-semibold text-white/85"
                                                title={row.product_name}
                                            >
                                                {row.product_name}
                                            </div>
                                            <div className="truncate text-[11px] text-white/35">
                                                product_id: {row.product_id ?? "—"}
                                            </div>
                                        </div>
                                    </Td>

                                    <Td>
                                        <div className="truncate text-white/70" title={row.customer_name}>
                                            {row.customer_name}
                                        </div>
                                    </Td>

                                    <Td>
                                        <span
                                            className={`inline-flex rounded-full border px-2 py-1 text-xs ${statusClass(
                                                row.status
                                            )}`}
                                        >
                                            {statusText(row.status)}
                                        </span>
                                    </Td>

                                    <Td className="text-white/60">{fmtDate(row.expires_at)}</Td>

                                    <Td className="text-white/60">{row.max_activations}</Td>

                                    <Td className="text-white/45">{fmtDate(row.created_at)}</Td>
                                </Tr>
                            ))}
                        </TBody>
                    </TableInner>

                    {!loading && filtered.length === 0 && (
                        <TableEmpty
                            title="Клиентские лицензии не найдены"
                            description="Попробуй изменить поиск или создать новый ключ."
                        />
                    )}
                </TableScroll>
            </Table>

            <Card className="p-4">
                <div className="grid gap-3 text-xs text-white/45 md:grid-cols-3">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-200" />
                        <div>
                            <div className="font-semibold text-white/70">
                                Server is source of truth
                            </div>
                            <div className="mt-1">
                                Клиентское приложение не решает само, активна ли лицензия.
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Ban className="mt-0.5 h-4 w-4 text-rose-200" />
                        <div>
                            <div className="font-semibold text-white/70">Blocked</div>
                            <div className="mt-1">
                                Блокировка сразу запрещает activation/check.
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-4 w-4 text-amber-200" />
                        <div>
                            <div className="font-semibold text-white/70">Expiration</div>
                            <div className="mt-1">
                                Срок проверяется на сервере через expires_at.
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}