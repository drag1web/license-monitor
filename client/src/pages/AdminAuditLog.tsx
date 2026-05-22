import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Download, Lock, RefreshCw, Search } from "lucide-react";
import { getAdminAuditLog, type AdminAuditLogRow } from "../api";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

function formatWhen(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    return new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(d);
}

function actionText(action: string) {
    const map: Record<string, string> = {
        run_check: "Запуск проверки",
        import_csv: "Импорт данных",
        update_license_registry: "Изменение лицензии",
        create_license_registry: "Создание лицензии",
        delete_license_registry: "Удаление лицензии",
        create_product: "Создание продукта",
        update_product: "Изменение продукта",
        delete_product: "Удаление продукта",
        create_mapping_rule: "Создание правила",
        update_mapping_rule: "Изменение правила",
        delete_mapping_rule: "Удаление правила",
        create_client_license: "Создание клиентского ключа",
        update_client_license: "Изменение клиентского ключа",
        block_client_license: "Блокировка клиентского ключа",
    };

    return map[action] ?? action;
}

function entityLabel(type: string) {
    const map: Record<string, string> = {
        run: "Запуск проверки",
        installations: "Установки",
        licenses_registry: "Реестр лицензий",
        mapping_rules: "Правила сопоставления",
        products: "Продукты",
        client_licenses: "Клиентские ключи",
    };

    return map[type] ?? type;
}

function escapeHtml(value: unknown) {
    const text = value === null || value === undefined ? "" : String(value);

    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function downloadTextFile(filename: string, text: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
}

function exportAuditExcel(rows: AdminAuditLogRow[]) {
    const tableRows = rows
        .map((row) => {
            return `
                <tr>
                    <td>${escapeHtml(row.id)}</td>
                    <td>${escapeHtml(formatWhen(row.created_at))}</td>
                    <td>${escapeHtml(row.login || "—")}</td>
                    <td>${escapeHtml(actionText(row.action))}</td>
                    <td>${escapeHtml(entityLabel(row.entity_type))}</td>
                    <td>${escapeHtml(row.entity_id || "")}</td>
                    <td>${escapeHtml(row.message || "—")}</td>
                    <td>${escapeHtml(row.action)}</td>
                    <td>${escapeHtml(row.entity_type)}</td>
                    <td>${escapeHtml(row.created_at)}</td>
                </tr>
            `;
        })
        .join("");

    const html = `
        <!doctype html>
        <html>
        <head>
            <meta charset="UTF-8" />
            <style>
                table {
                    border-collapse: collapse;
                    font-family: Arial, sans-serif;
                    font-size: 12px;
                }

                th {
                    background: #f1f5f9;
                    font-weight: 700;
                    border: 1px solid #cbd5e1;
                    padding: 6px 8px;
                    text-align: left;
                }

                td {
                    border: 1px solid #cbd5e1;
                    padding: 6px 8px;
                    vertical-align: top;
                    mso-number-format: "\\@";
                }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Дата ISO</th>
                        <th>Дата</th>
                        <th>Пользователь</th>
                        <th>Действие</th>
                        <th>Действие в интерфейсе</th>
                        <th>Тип сущности</th>
                        <th>Сущность</th>
                        <th>ID сущности</th>
                        <th>Сообщение</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>
    `.trim();

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    downloadTextFile(
        `license-monitor-audit-log-${stamp}.xls`,
        `\uFEFF${html}`,
        "application/vnd.ms-excel;charset=utf-8"
    );
}

export default function AdminAuditLog() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    const [items, setItems] = useState<AdminAuditLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [q, setQ] = useState("");

    async function refresh() {
        setLoading(true);
        setErr("");

        if (!isAdmin) {
            setItems([]);
            setLoading(false);
            return;
        }

        try {
            const rows = await getAdminAuditLog(300);
            setItems(rows ?? []);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setErr(
                msg.includes("forbidden")
                    ? "Журнал действий доступен только администратору."
                    : msg
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void refresh();
    }, [isAdmin]);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return items;

        return items.filter((x) =>
            [
                x.login ?? "",
                x.action,
                x.entity_type,
                x.entity_id ?? "",
                x.message ?? "",
                x.created_at,
            ]
                .join(" ")
                .toLowerCase()
                .includes(needle)
        );
    }, [items, q]);

    if (!isAdmin) {
        return (
            <div className="space-y-6">
                <Card className="p-5">
                    <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
                            <Lock className="h-5 w-5" />
                        </div>

                        <div>
                            <div className="text-base font-semibold text-slate-950">
                                Журнал действий доступен только администратору
                            </div>
                            <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                                В режиме просмотра административный аудит скрыт. Пользователь
                                может просматривать основные разделы системы, отчёты,
                                уведомления и историю запусков, но не видит служебный журнал
                                изменений.
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="p-8 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
                        <ClipboardList className="h-5 w-5" />
                    </div>

                    <div className="mt-4 text-sm font-semibold text-slate-950">
                        Режим просмотра
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                        Для доступа к журналу действий войдите под учётной записью администратора.
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                            <ClipboardList className="h-4 w-4 text-slate-500" />
                            Журнал действий администратора
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                            Фиксируются важные операции: импорт данных, запуск проверок и изменения справочников.
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => exportAuditExcel(filtered)}
                            disabled={loading || filtered.length === 0}
                        >
                            <Download className="h-4 w-4" />
                            Экспорт Excel
                        </Button>

                        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}>
                            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                            Обновить
                        </Button>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Поиск по пользователю, действию, сущности или сообщению..."
                        className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                </div>
            </Card>

            {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {err}
                </div>
            )}

            <Card className="overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-4">
                    <div className="text-sm font-semibold text-slate-950">События</div>
                    <div className="mt-1 text-xs text-slate-500">
                        Показано: {filtered.length} / {items.length}
                    </div>
                </div>

                {loading ? (
                    <div className="p-5 text-sm text-slate-500">Загрузка журнала...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                        Записей журнала пока нет.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Дата</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Пользователь</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Действие</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Сущность</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Сообщение</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-200 bg-white">
                                {filtered.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50">
                                        <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                                            {formatWhen(row.created_at)}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            {row.login || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            {actionText(row.action)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">
                                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                                                {entityLabel(row.entity_type)}
                                                {row.entity_id ? ` #${row.entity_id}` : ""}
                                            </span>
                                        </td>
                                        <td className="max-w-xl px-4 py-3 text-slate-600">
                                            {row.message || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}