import React from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const BREAD_MAP: Record<string, string> = {
  runs: "Запуски проверок",
  diff: "Сравнение запусков",
  settings: "Настройки",
  licenses: "Реестр лицензий",
  login: "Вход",
  imports: "Импорты",
  alerts: "Уведомления",
  dictionaries: "Справочники",
  products: "Продукты",
  mapping: "Правила сопоставления",
  "client-licenses": "Клиентские ключи",
};

function humanizeSegment(seg: string) {
  if (/^\d+$/.test(seg)) return `#${seg}`;
  return BREAD_MAP[seg] ?? seg.replace(/[-_]/g, " ");
}

export function PageHeader({
  title,
  right,
  subtitle,
  showBreadcrumbs = true,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showTabs?: boolean;
  showBreadcrumbs?: boolean;
}) {
  const { pathname } = useLocation();

  const parts = React.useMemo(() => {
    const raw = pathname.split("/").filter(Boolean);
    return raw.map((p, i) => ({
      raw: p,
      label: humanizeSegment(p),
      href: "/" + raw.slice(0, i + 1).join("/"),
    }));
  }, [pathname]);

  return (
    <div className="mb-6">
      {showBreadcrumbs && (
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-slate-500">
          <Link
            to="/"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-slate-200 hover:text-slate-900"
          >
            <Home className="h-4 w-4" />
            <span>Главная</span>
          </Link>

          {parts.map((p, idx) => (
            <span key={p.href} className="inline-flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-slate-400" />
              {idx < parts.length - 1 ? (
                <Link
                  to={p.href}
                  className="rounded-md px-1.5 py-1 hover:bg-slate-200 hover:text-slate-900"
                >
                  {p.label}
                </Link>
              ) : (
                <span className="rounded-md px-1.5 py-1 text-slate-700">
                  {p.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            {title}
          </h1>

          {subtitle && (
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}