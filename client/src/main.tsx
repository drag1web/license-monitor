import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ToastProvider } from "./ui/toast";
import { SettingsProvider } from "./settings/SettingsContext";

import "./index.css";

function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <ToastProvider>
          <SettingsProvider>
            <AuthProvider>{children}</AuthProvider>
          </SettingsProvider>
        </ToastProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <RootProviders>
    <App />
  </RootProviders>
);
