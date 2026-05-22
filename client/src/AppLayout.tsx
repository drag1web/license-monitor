import type React from "react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  Database,
  Eye,
  FileInput,
  History,
  KeyRound,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import { TopBar } from "./components/TopBar";
import { AlertsBell } from "./components/AlertsBell";
import { ViewerNotice } from "./components/ViewerNotice";
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
  { to: "/admin-audit-log", label: "Журнал действий", icon: ClipboardList },
  { to: "/settings", label: "Настройки", icon: Settings },
];

function roleLabel(role?: string) {
  return role === "admin" ? "Администратор" : "Просмотр";
}

function UserInfoDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: { login: string; role: string } | null;
}) {
  if (!open || !user) return null;

  const isAdmin = user.role === "admin";

  const rights = isAdmin
    ? [
      "запуск проверок лицензий",
      "импорт CSV-файлов",
      "изменение реестра лицензий",
      "управление справочниками",
      "управление клиентскими ключами",
      "просмотр журнала действий",
    ]
    : [
      "просмотр dashboard и результатов проверок",
      "просмотр истории запусков",
      "просмотр реестра лицензий",
      "просмотр справочников и уведомлений",
      "скачивание доступных отчётов",
      "без права изменения данных",
    ];

  return (
    <div className="fixed inset-x-0 bottom-0 top-12 z-[120] grid place-items-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
              <UserRound className="h-5 w-5" />
            </div>

            <div>
              <div className="text-base font-semibold text-slate-950">
                Информация о пользователе
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Текущая учётная запись и доступные права.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Логин</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">
                {user.login}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Роль</div>
              <div className="mt-1 text-sm font-semibold text-slate-950">
                {roleLabel(user.role)}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-950">
              Права доступа
            </div>

            <ul className="mt-3 space-y-2">
              {rights.map((right) => (
                <li key={right} className="flex gap-2 text-sm text-slate-600">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{right}</span>
                </li>
              ))}
            </ul>
          </div>

          {!isAdmin && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              В режиме просмотра недоступны импорт, запуск проверок, изменение
              лицензий, справочников, клиентских ключей и удаление данных.
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewerLoginDialog({
  open,
  onClose,
  login,
}: {
  open: boolean;
  onClose: () => void;
  login: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-12 z-[130] grid place-items-center bg-slate-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
              <Eye className="h-5 w-5" />
            </div>

            <div>
              <div className="text-base font-semibold text-slate-950">
                Включён режим просмотра
              </div>
              <div className="mt-1 text-sm leading-6 text-slate-500">
                Вы вошли как пользователь <b>{login}</b>. Система открыта в
                режиме ограниченного доступа.
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm leading-6 text-slate-600">
          <p>
            Доступны просмотр отчётов, истории запусков, уведомлений,
            справочников, реестра лицензий и клиентских ключей.
          </p>

          <p>
            Изменение данных, импорт CSV, запуск проверок, удаление записей и
            административные действия доступны только пользователю с ролью
            администратора.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const { pathname } = useLocation();
  const isLoginPage = pathname === "/login";
  const { user, logout } = useAuth();

  const [userInfoOpen, setUserInfoOpen] = useState(false);
  const [viewerDialogOpen, setViewerDialogOpen] = useState(false);

  const isViewer = Boolean(user && user.role !== "admin");

  useEffect(() => {
    if (isLoginPage) return;
    if (!user || user.role === "admin") return;

    const shouldShow = sessionStorage.getItem("lm_show_viewer_login_modal");

    if (shouldShow === "1") {
      setViewerDialogOpen(true);
      sessionStorage.removeItem("lm_show_viewer_login_modal");
    }
  }, [isLoginPage, user]);

  if (isLoginPage) {
    return (
      <div className="h-screen overflow-hidden bg-slate-200 text-slate-950">
        <TopBar
          title="License Monitor"
          subtitle="Система мониторинга лицензирования ПО"
        />

        <main className="h-[calc(100vh-48px)] w-full overflow-y-auto">
          {children ?? <Outlet />}
        </main>
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

      <ViewerLoginDialog
        open={viewerDialogOpen}
        login={user?.login ?? ""}
        onClose={() => setViewerDialogOpen(false)}
      />

      <UserInfoDialog
        open={userInfoOpen}
        user={user}
        onClose={() => setUserInfoOpen(false)}
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
            <button
              type="button"
              onClick={() => setUserInfoOpen(true)}
              className="mb-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <div className="text-xs text-slate-500">Пользователь</div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                {user?.login ?? "admin"}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Роль: {roleLabel(user?.role)}
              </div>
            </button>

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
            {isViewer && (
              <ViewerNotice
                className="mb-6"
                message="Вы вошли как пользователь с правами просмотра. Изменение данных, запуск проверок, импорт CSV и удаление записей недоступны."
              />
            )}

            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}