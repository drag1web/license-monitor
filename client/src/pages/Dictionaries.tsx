import type React from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Boxes, GitBranch } from "lucide-react";

import { Card } from "../ui/Card";
import { cn } from "../ui/cn/cn";
import { ViewerNotice } from "../components/ViewerNotice";
import { useAuth } from "../auth/AuthContext";

type DictionariesProps = {
    children: React.ReactNode;
};

const tabs = [
    {
        to: "/dictionaries/products",
        label: "Продукты",
        icon: <Boxes className="h-4 w-4" />,
        match: (pathname: string) => pathname.startsWith("/dictionaries/products"),
    },
    {
        to: "/dictionaries/mapping",
        label: "Правила сопоставления",
        icon: <GitBranch className="h-4 w-4" />,
        match: (pathname: string) => pathname.startsWith("/dictionaries/mapping"),
    },
];

export default function Dictionaries({ children }: DictionariesProps) {
    const { pathname } = useLocation();
    const { user } = useAuth();

    return (
        <div className="space-y-4">
            <Card
                className={cn(
                    "relative overflow-hidden rounded-[28px] border border-white/[0.08]",
                    "bg-gradient-to-b from-slate-950/72 via-slate-950/48 to-slate-950/28",
                    "backdrop-blur-xl shadow-[0_24px_90px_rgba(0,0,0,0.42)]"
                )}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
                <div className="pointer-events-none absolute -left-24 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="pointer-events-none absolute -right-24 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

                <div className="relative p-5 md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100/90">
                                <BookOpen className="h-3.5 w-3.5" />
                                <span>Справочники нормализации</span>
                            </div>

                            <h2 className="mt-3 text-xl md:text-2xl font-semibold tracking-tight text-white/92">
                                Продукты и правила сопоставления
                            </h2>

                            <p className="mt-2 max-w-3xl text-sm text-white/55">
                                Управление каноническими продуктами и правилами, по которым сырые
                                записи установок приводятся к единому виду для анализа лицензий.
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                        {tabs.map((tab) => {
                            const active = tab.match(pathname);

                            return (
                                <Link
                                    key={tab.to}
                                    to={tab.to}
                                    className={cn(
                                        "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition",
                                        "border outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25",
                                        active
                                            ? cn(
                                                "border-cyan-200/18 text-white/92",
                                                "bg-gradient-to-b from-cyan-300/14 via-white/[0.07] to-white/[0.04]",
                                                "shadow-[0_14px_55px_rgba(34,211,238,0.10)]"
                                            )
                                            : cn(
                                                "border-white/[0.08] bg-white/[0.02] text-white/72",
                                                "hover:bg-white/[0.05] hover:text-white/88 hover:border-white/[0.12]"
                                            )
                                    )}
                                >
                                    <span className={cn("text-white/55", active && "text-cyan-200/90")}>
                                        {tab.icon}
                                    </span>
                                    <span>{tab.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {user?.role === "viewer" && (
                <ViewerNotice message="У вас режим только просмотра. Управление справочниками доступно только администратору." />
            )}

            {children}
        </div>
    );
}