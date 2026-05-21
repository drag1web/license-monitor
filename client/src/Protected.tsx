import type React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "./auth/AuthContext";
import { cn } from "./ui/cn/cn";

/**
 * Protected — Auth Gate
 * - красивый loading overlay
 * - аккуратный редирект на /login
 * - запоминает страницу (from)
 */

export function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 1) Пока проверяем сессию
  if (loading) {
    return <AuthLoading />;
  }

  // 2) Не авторизован → на логин
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  // 3) Всё ок
  return <>{children}</>;
}

/* ------------------------------------------
 * Loading screen
 * ------------------------------------------ */

function AuthLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060B16] text-white">
      {/* subtle background */}
      <div className="absolute inset-0 bg-[radial-gradient(800px_500px_at_50%_30%,rgba(34,211,238,0.12),transparent_60%)]" />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="relative min-h-screen flex items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className={cn(
              "relative rounded-3xl px-8 py-7",
              "bg-white/[0.04] backdrop-blur-xl",
              "border border-white/10",
              "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_80px_-40px_rgba(0,0,0,0.9)]"
            )}
          >
            {/* top glow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/8 flex items-center justify-center border border-white/10">
                <ShieldCheck className="h-6 w-6 text-cyan-200/90" />
              </div>

              <div className="text-sm font-semibold text-white/90">
                Проверяем доступ
              </div>

              <div className="text-xs text-white/55 max-w-[32ch]">
                Проверяем активную сессию и права пользователя
              </div>

              <div className="mt-2 flex items-center gap-2 text-xs text-white/60">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Авторизация…</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
