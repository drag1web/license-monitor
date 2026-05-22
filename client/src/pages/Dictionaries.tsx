import type React from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Boxes, GitBranch } from "lucide-react";

import { Card } from "../ui/Card";
import { cn } from "../ui/cn/cn";

type DictionariesProps = {
  children: React.ReactNode;
};

const tabs = [
  {
    to: "/dictionaries/products",
    label: "Продукты",
    icon: <Boxes className="h-4 w-4" />,
    match: (pathname: string) => pathname.startsWith("/dictionaries/products"),
    hint: "Канонические продукты, которые используются в реестре лицензий и правилах сопоставления.",
  },
  {
    to: "/dictionaries/mapping",
    label: "Правила сопоставления",
    icon: <GitBranch className="h-4 w-4" />,
    match: (pathname: string) => pathname.startsWith("/dictionaries/mapping"),
    hint: "Правила приведения сырых названий ПО к каноническим продуктам.",
  },
];

export default function Dictionaries({ children }: DictionariesProps) {
  const { pathname } = useLocation();

  const activeTab = tabs.find((tab) => tab.match(pathname)) ?? tabs[0];

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
              <BookOpen className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="text-xl font-semibold text-slate-950">
                Справочники
              </div>

              <div className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Управление каноническими продуктами и правилами сопоставления,
                которые используются при анализе установок и расчёте лицензий.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const active = tab.match(pathname);

              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-950">
            {activeTab.label}
          </div>
          <div className="mt-1 text-sm text-slate-600">{activeTab.hint}</div>
        </div>
      </Card>

      {children}
    </div>
  );
}