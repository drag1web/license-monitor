import type React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BookOpen,
  Database,
  FileInput,
  History,
  KeyRound,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { TopBar } from "./components/TopBar";
import { AlertsBell } from "./components/AlertsBell";
import { useAuth } from "./auth/AuthContext";
import { cn } from "./ui/cn/cn";

const NAV_ITEMS = [
  { to: "/", label: "Обзор", icon: BarChart3 },
  { to: "/runs", label: "Запуски проверок", icon: History },
  { to: "/licenses", label: "Реестр лицензий", icon: Database },
  { to: "/client-licenses", label: "Клиентские ключи", icon: KeyRound },
  { to: "/imports", label: "Импорты", icon: FileInput },
  { to: "/dictionaries/products", label: "Справочники", icon: BookOpen },
  { to: "/alerts", label: "Уведомления", icon: Bell },
  { to: "/settings", label: "Настройки", icon: Settings },
];

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const { pathname } = useLocation();
  const isLoginPage = pathname === "/login";
  const { user, logout } = useAuth();

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-950">
        {children ?? <Outlet />}
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-200 text-slate-950">
      <TopBar
        title="License Monitor"
        subtitle="Система мониторинга лицензирования ПО"
        rightSlot={user ? <AlertsBell /> : undefined}
      />

      <div className="flex h-[calc(100vh-48px)] overflow-hidden">
        <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  License Monitor
                </div>
                <div className="truncate text-xs text-slate-500">
                  Панель администратора
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Пользователь</div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                {user?.login ?? "admin"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Роль: {user?.role === "admin" ? "Администратор" : "Просмотр"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void logout()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-6 py-6">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}