import type React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { AppStatusDock } from "./components/AppStatusDock";
import { AlertsBell } from "./components/AlertsBell";
import { useAuth } from "./auth/AuthContext";

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const { pathname } = useLocation();
  const isLoginPage = pathname === "/login";
  const { user } = useAuth();

  return (
    <div
      className={[
        "h-screen overflow-hidden",
        "bg-[rgb(var(--bg))] text-[rgb(var(--fg))]",
      ].join(" ")}
    >
      <TopBar
        title="License Monitor"
        rightSlot={!isLoginPage && user ? <AlertsBell /> : undefined}
      />

      {!isLoginPage && <AppStatusDock />}

      <div className="h-[calc(100vh-48px)] overflow-y-auto no-scrollbar">
        {children ?? <Outlet />}
      </div>
    </div>
  );
}