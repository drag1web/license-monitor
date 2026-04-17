import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Lock,
  User as UserIcon,
  Loader2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  CircleCheck,
  KeyRound,
  ArrowRight,
  Zap,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../ui/cn/cn";

/**
 * ==========================================
 *  Login — "premium glass" edition
 * ==========================================
 * - consistent palette with dashboard
 * - background: blobs + grid + noise + vignette
 * - split layout: product pitch + secure sign-in
 * - animated error, focus rings, strong UI polish
 */

const schema = z.object({
  login: z.string().min(3, "Минимум 3 символа"),
  password: z.string().min(4, "Минимум 4 символа"),
});

type FormValues = z.infer<typeof schema>;

const pageAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

const cardAnim = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const softPop = {
  hidden: { opacity: 0, y: -6 },
  show: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

function Pill({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: "neutral" | "ok" | "warn" | "info";
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const palette =
    tone === "ok"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "warn"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : tone === "info"
          ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100"
          : "border-white/10 bg-white/[0.03] text-white/70";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl px-3 py-1.5 text-[12px] font-semibold border",
        palette,
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function GlassPanel({
  className,
  children,
  glow = "cyan",
}: {
  className?: string;
  children: React.ReactNode;
  glow?: "cyan" | "indigo" | "emerald";
}) {
  const blob =
    glow === "indigo"
      ? "bg-indigo-500/10"
      : glow === "emerald"
        ? "bg-emerald-400/10"
        : "bg-cyan-400/10";

  return (
    <div
      className={cn(
        "relative rounded-3xl p-8 overflow-hidden",
        "bg-white/[0.04] backdrop-blur-xl",
        "border border-white/10",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_20px_90px_-45px_rgba(0,0,0,0.92)]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className={cn("pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-2xl", blob)} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-black/25" />
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  left,
  right,
  children,
  focusGlow = "cyan",
}: {
  label: string;
  error?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  focusGlow?: "cyan" | "indigo";
}) {
  const ring =
    focusGlow === "indigo"
      ? "focus-within:border-indigo-200/30 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.10)]"
      : "focus-within:border-cyan-200/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.10)]";

  return (
    <div>
      <label className="text-sm text-white/80">{label}</label>
      <div
        className={cn(
          "mt-2 flex items-center gap-2 rounded-2xl border px-4 py-3 transition",
          "bg-white/[0.035]",
          error ? "border-rose-400/40" : cn("border-white/10", ring)
        )}
      >
        {left && <span className="text-white/55">{left}</span>}
        <div className="w-full">{children}</div>
        {right}
      </div>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-1 text-xs text-rose-200"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DividerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
        {children}
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export default function Login() {
  const nav = useNavigate();
  const { login: doLogin, register: doRegister } = useAuth();

  const [show, setShow] = useState(false);
  const [apiError, setApiError] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { login: "admin", password: "admin" },
    mode: "onSubmit",
  });

  const tips = useMemo(
    () => [
      {
        k: "Дефолтные креды",
        v: "admin / admin",
        icon: <KeyRound className="h-4 w-4" />,
        tone: "info" as const,
      },
      {
        k: "Доступ",
        v: "нужен для запусков проверок",
        icon: <Zap className="h-4 w-4" />,
        tone: "neutral" as const,
      },
      {
        k: "Рекомендация",
        v: "поменяй пароль позже",
        icon: <Sparkles className="h-4 w-4" />,
        tone: "warn" as const,
      },
    ],
    []
  );

  async function onSubmit(v: FormValues) {
    setApiError("");

    try {
      if (mode === "login") {
        await doLogin(v.login.trim(), v.password);
      } else {
        await doRegister(v.login.trim(), v.password);
      }

      nav("/", { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setApiError(msg);
      setTimeout(() => setFocus("password"), 0);
    }
  }

  async function copyDefaultCreds() {
    try {
      await navigator.clipboard.writeText("admin / admin");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={pageAnim}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="min-h-screen relative overflow-hidden bg-[#060B16] text-white"
    >
      {/* Background layers */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_18%_10%,rgba(99,102,241,0.26),transparent_55%),radial-gradient(950px_620px_at_82%_22%,rgba(34,211,238,0.20),transparent_58%),radial-gradient(980px_760px_at_52%_92%,rgba(16,185,129,0.14),transparent_60%)]" />

        {/* Glow blobs */}
        <div className="absolute -top-52 -left-56 h-[680px] w-[680px] rounded-full bg-indigo-500/16 blur-3xl" />
        <div className="absolute -top-44 -right-60 h-[720px] w-[720px] rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="absolute -bottom-56 left-1/2 -translate-x-1/2 h-[740px] w-[900px] rounded-full bg-emerald-400/10 blur-3xl" />

        {/* Micro grid */}
        <div className="absolute inset-0 opacity-[0.085] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(900px_560px_at_50%_25%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />

        {/* Noise */}
        <div className="absolute inset-0 opacity-[0.06] [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%222%22 stitchTiles=%22stitch%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.4%22/></svg>')]" />
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial="hidden"
          animate="show"
          variants={cardAnim}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="w-full max-w-6xl grid lg:grid-cols-2 gap-6"
        >
          {/* Left: Product / Promo */}
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05, duration: 0.55, ease: "easeOut" }}
          >
            <GlassPanel glow="indigo">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-white/8 flex items-center justify-center border border-white/10">
                  <ShieldCheck className="h-5 w-5 text-white/85" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs tracking-wide text-white/65">
                    License Monitor
                  </div>
                  <div className="text-xl font-semibold leading-tight text-white/90">
                    Мониторинг лицензирования ПО
                  </div>
                </div>
              </div>

              <p className="mt-5 text-white/72 leading-relaxed">
                Доступ открывает запуск проверок, историю прогонов и выгрузку
                отчётов. Всё — в одном интерфейсе: Electron + SPA, сервер —
                Express + SQLite.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="info" icon={<CircleCheck className="h-4 w-4" />}>
                  Быстро
                </Pill>
                <Pill tone="neutral" icon={<ShieldCheck className="h-4 w-4" />}>
                  Контроль
                </Pill>
                <Pill tone="neutral" icon={<Sparkles className="h-4 w-4" />}>
                  Отчёты
                </Pill>
              </div>

              <div className="mt-7">
                <DividerLabel>подсказки</DividerLabel>
                <div className="mt-4 grid gap-3">
                  {tips.map((t) => (
                    <div
                      key={t.k}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-2xl border border-white/10",
                        "bg-white/[0.035] px-4 py-3"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            "h-9 w-9 rounded-2xl grid place-items-center border",
                            t.tone === "info"
                              ? "border-cyan-300/20 bg-cyan-500/10 text-cyan-100"
                              : t.tone === "warn"
                                ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
                                : "border-white/10 bg-white/[0.03] text-white/70"
                          )}
                        >
                          {t.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm text-white/65">{t.k}</div>
                          <div className="text-sm font-semibold text-white/90 truncate">
                            {t.v}
                          </div>
                        </div>
                      </div>

                      {t.k === "Дефолтные креды" && (
                        <button
                          type="button"
                          onClick={copyDefaultCreds}
                          className={cn(
                            "shrink-0 rounded-2xl px-3 py-2 text-[12px] font-semibold border",
                            "border-white/10 bg-white/[0.03] text-white/80",
                            "hover:bg-white/[0.06] hover:border-white/[0.12]",
                            "transition outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                          )}
                          title="Скопировать"
                        >
                          {copied ? "Скопировано" : "Copy"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7 flex items-center gap-2 text-xs text-white/45">
                <Sparkles className="h-4 w-4" />
                <span>
                  Потом: поменяй креды и вынеси secret в env (как взрослый).
                </span>
              </div>
            </GlassPanel>
          </motion.div>

          {/* Right: Login form */}
          <motion.div
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08, duration: 0.55, ease: "easeOut" }}
          >
            <GlassPanel glow="cyan">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs tracking-wide text-white/65">
                    Добро пожаловать
                  </div>
                  <div className="text-2xl font-semibold mt-1 text-white/90">
                    {mode === "login" ? "Войти в систему" : "Создать аккаунт"}
                  </div>
                  <div className="mt-1 text-sm text-white/50">
                    {mode === "login"
                      ? "Авторизация нужна, чтобы управлять проверками и отчётами."
                      : "Создай локальную учетную запись для работы с системой."}
                  </div>
                </div>

                <Pill tone="neutral" icon={<ShieldCheck className="h-4 w-4" />}>
                  Secure UI
                </Pill>
              </div>

              <AnimatePresence>
                {apiError && (
                  <motion.div
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    variants={softPop}
                    className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-2 font-semibold text-rose-100">
                      <TriangleAlert className="h-4 w-4" />
                      {mode === "login" ? "Ошибка входа" : "Ошибка регистрации"}
                    </div>
                    <div className="text-white/75 mt-0.5">{apiError}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
                {/* Login */}
                <Field
                  label="Логин"
                  error={errors.login?.message}
                  left={<UserIcon className="h-4 w-4" />}
                  focusGlow="cyan"
                >
                  <input
                    {...register("login")}
                    className="w-full bg-transparent outline-none placeholder:text-white/30 text-sm text-white/85"
                    placeholder="например: admin"
                    autoComplete="username"
                  />
                </Field>

                {/* Password */}
                <Field
                  label="Пароль"
                  error={errors.password?.message}
                  left={<Lock className="h-4 w-4" />}
                  focusGlow="indigo"
                  right={
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className={cn(
                        "rounded-xl p-1.5 transition",
                        "hover:bg-white/10 active:bg-white/15",
                        "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                      )}
                      aria-label="toggle password"
                      title={show ? "Скрыть" : "Показать"}
                    >
                      {show ? (
                        <EyeOff className="h-4 w-4 text-white/70" />
                      ) : (
                        <Eye className="h-4 w-4 text-white/70" />
                      )}
                    </button>
                  }
                >
                  <input
                    {...register("password")}
                    type={show ? "text" : "password"}
                    className="w-full bg-transparent outline-none placeholder:text-white/30 text-sm text-white/85"
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </Field>

                {/* Submit */}
                <motion.button
                  whileTap={{ scale: 0.99 }}
                  disabled={isSubmitting}
                  className={cn(
                    "relative w-full rounded-2xl py-3 font-semibold transition",
                    "text-slate-950",
                    "bg-gradient-to-r from-cyan-200 via-white to-indigo-200",
                    "hover:brightness-[1.02]",
                    "disabled:opacity-60 disabled:cursor-not-allowed",
                    "shadow-[0_12px_46px_-22px_rgba(34,211,238,0.60)]",
                    "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/25"
                  )}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {isSubmitting
                      ? mode === "login"
                        ? "Выполняю вход..."
                        : "Создаю аккаунт..."
                      : mode === "login"
                        ? "Войти"
                        : "Зарегистрироваться"}
                  </span>
                  <span className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition bg-[radial-gradient(120px_60px_at_50%_0%,rgba(255,255,255,0.65),transparent_70%)]" />
                </motion.button>

                <div className="text-xs text-white/45 text-center pt-1">
                  {mode === "login"
                    ? "Нажимая “Войти”, ты подтверждаешь доступ к запуску проверок и скачиванию отчётов."
                    : "Нажимая “Зарегистрироваться”, ты создаёшь локальную учетную запись для работы с системой."}
                </div>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setApiError("");
                      setMode((m) => (m === "login" ? "register" : "login"));
                    }}
                    className="text-sm text-cyan-200/85 hover:text-cyan-200 transition underline underline-offset-4"
                  >
                    {mode === "login"
                      ? "Нет аккаунта? Зарегистрироваться"
                      : "Уже есть аккаунт? Войти"}
                  </button>
                </div>
              </form>

              <div className="mt-6 flex items-center justify-between text-xs text-white/45">
                <span>v1.0 • Electron + Express</span>
                <span className="font-mono">admin/admin</span>
              </div>
            </GlassPanel>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
