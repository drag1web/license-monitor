import type React from "react";
import { Outlet } from "react-router-dom";
import { TopBar } from "./components/TopBar";
import { AppStatusDock } from "./components/AppStatusDock";

export function AppLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div
      className={[
        "h-screen overflow-hidden",
        "bg-[rgb(var(--bg))] text-[rgb(var(--fg))]",
      ].join(" ")}
    >
      <TopBar title="License Monitor" />

      <AppStatusDock />

      {/* Scroll only inside content area */}
      <div className="h-[calc(100vh-48px)] overflow-y-auto no-scrollbar">
        {children ?? <Outlet />}
      </div>
    </div>
  );
}