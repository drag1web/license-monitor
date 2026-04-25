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
    hint: "Канонические продукты для нормализации и справочников.",
  },
  {
    to: "/dictionaries/mapping",
    label: "Правила сопоставления",
    icon: <GitBranch className="h-4 w-4" />,
    match: (pathname: string) => pathname.startsWith("/dictionaries/mapping"),
    hint: "Правила приведения сырого ПО к каноническим продуктам.",
  },
];

export default function Dictionaries({ children }: DictionariesProps) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const activeTab = tabs.find((tab) => tab.match(pathname)) ?? tabs[0];

  return (
    <div className="space-y-6">
      <Card
        className={cn(
          "relative overflow-hidden rounded-3xl p-5",
          "border border-white/[0.08]",
          "bg-gradient-to-b from-slate-950/70 via-slate-950/45 to-slate-950/25",
          "backdrop-blur-xl",
          "shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent" />
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div
                className={cn(
                  "grid h-14 w-14 shrink-0 place-items-center rounded-3xl",
                  "bg-[rgba(var(--fg),0.04)]",
                  "shadow-[0_18px_60px_rgba(34,211,238,0.10)]"
                )}
              >
                <BookOpen className="h-7 w-7 text-cyan-300/90" />
              </div>

              <div className="min-w-0">
                <div className="text-xs tracking-wide text-white/46">
                  Справочники нормализации
                </div>

                <div className="mt-1 text-3xl font-semibold tracking-tight text-white/92">
                  Справочники
                </div>

                <div className="mt-2 max-w-[72ch] text-sm leading-relaxed text-white/58">
                  Управление каноническими продуктами и правилами сопоставления,
                  по которым сырые записи установок приводятся к единому виду
                  для анализа лицензий.
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {tabs.map((tab) => {
                    const active = tab.match(pathname);

                    return (
                      <Link
                        key={tab.to}
                        to={tab.to}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition",
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
                        <span
                          className={cn(
                            "text-white/55",
                            active && "text-cyan-200/90"
                          )}
                        >
                          {tab.icon}
                        </span>
                        <span>{tab.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "rounded-3xl border border-white/[0.08] bg-white/[0.02] p-4"
            )}
          >
            <div className="text-sm font-semibold text-white/88">
              {activeTab.label}
            </div>
            <div className="mt-1 text-sm text-white/50">{activeTab.hint}</div>
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