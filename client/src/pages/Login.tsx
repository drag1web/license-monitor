import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  Lock,
  Server,
  ShieldCheck,
  TriangleAlert,
  User as UserIcon,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../ui/cn/cn";

const schema = z.object({
  login: z.string().min(3, "Минимум 3 символа"),
  password: z.string().min(4, "Минимум 4 символа"),
});

type FormValues = z.infer<typeof schema>;

const BOOT_STEPS = [
  "Проверка учётной записи",
  "Подключение к серверу",
  "Загрузка лицензий",
  "Загрузка справочников",
  "Подготовка панели администратора",
];

function Field({
  label,
  error,
  left,
  right,
  children,
}: {
  label: string;
  error?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">{label}</label>

      <div
        className={cn(
          "mt-2 flex items-center gap-2 rounded-lg border bg-white px-3 py-2.5 transition",
          error
            ? "border-red-300 ring-2 ring-red-100"
            : "border-slate-300 focus-within:border-slate-600 focus-within:ring-2 focus-within:ring-slate-100"
        )}
      >
        {left && <span className="text-slate-400">{left}</span>}
        <div className="w-full">{children}</div>
        {right}
      </div>

      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-xs leading-relaxed text-slate-500">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingOverlay({
  activeStep,
  mode,
}: {
  activeStep: number;
  mode: "login" | "register";
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/35 px-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-300 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.22)]">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>

          <div>
            <div className="text-lg font-semibold text-slate-950">
              {mode === "login" ? "Выполняется вход" : "Создание учётной записи"}
            </div>
            <div className="mt-1 text-sm leading-6 text-slate-500">
              Подготавливаем рабочую среду License Monitor.
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {BOOT_STEPS.map((step, idx) => {
            const done = idx < activeStep;
            const current = idx === activeStep;

            return (
              <div
                key={step}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <div
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full border",
                    done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : current
                        ? "border-slate-300 bg-white text-slate-700"
                        : "border-slate-200 bg-white text-slate-400"
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : current ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  )}
                </div>

                <span
                  className={cn(
                    "text-sm",
                    done || current ? "text-slate-800" : "text-slate-500"
                  )}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-all duration-300"
            style={{
              width: `${Math.min(100, ((activeStep + 1) / BOOT_STEPS.length) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const nav = useNavigate();
  const { login: doLogin, register: doRegister } = useAuth();

  const [show, setShow] = useState(false);
  const [apiError, setApiError] = useState("");
  const [remember, setRemember] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [booting, setBooting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    setFocus,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { login: "admin", password: "admin" },
  });

  useEffect(() => {
    const saved = localStorage.getItem("lm_login_saved");
    if (saved) setValue("login", saved);
  }, [setValue]);

  async function runBootAnimation() {
    setBooting(true);
    setActiveStep(0);

    for (let i = 0; i < BOOT_STEPS.length; i++) {
      setActiveStep(i);
      await new Promise((resolve) => setTimeout(resolve, 260));
    }
  }

  async function onSubmit(v: FormValues) {
    setApiError("");

    try {
      const cleanLogin = v.login.trim();

      await runBootAnimation();

      if (mode === "login") {
        await doLogin(cleanLogin, v.password);
      } else {
        await doRegister(cleanLogin, v.password);
      }

      if (remember) {
        localStorage.setItem("lm_login_saved", cleanLogin);
      } else {
        localStorage.removeItem("lm_login_saved");
      }

      setActiveStep(BOOT_STEPS.length);
      await new Promise((resolve) => setTimeout(resolve, 250));

      nav("/", { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setApiError(msg);
      setBooting(false);
      setTimeout(() => setFocus("password"), 0);
    }
  }

  function fillAdminDemo() {
    setValue("login", "admin");
    setValue("password", "admin");
    setApiError("");
  }

  return (
    <div className="min-h-screen bg-slate-200 px-6 py-10 text-slate-950">
      {booting && <LoadingOverlay activeStep={activeStep} mode={mode} />}

      <div className="mx-auto grid min-h-[calc(100vh-80px)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              License Monitor
            </div>

            <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight text-slate-950">
              Система мониторинга лицензирования программного обеспечения
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              Панель администратора для контроля лицензий, анализа дефицитов,
              просмотра истории проверок и формирования отчётности.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <InfoCard
              icon={<Database className="h-4 w-4" />}
              title="Локальная база данных"
              text="Хранение запусков, результатов анализа, лицензий и справочников."
            />
            <InfoCard
              icon={<FileSpreadsheet className="h-4 w-4" />}
              title="Импорт и отчёты"
              text="Загрузка CSV-файлов и выгрузка результатов проверки."
            />
            <InfoCard
              icon={<Server className="h-4 w-4" />}
              title="Клиентские ключи"
              text="Управление лицензиями для защищённых клиентских приложений."
            />
            <InfoCard
              icon={<ClipboardCheck className="h-4 w-4" />}
              title="Контроль доступа"
              text="Разделение ролей администратора и пользователя для просмотра."
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,0.10)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-slate-500">Добро пожаловать</div>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                {mode === "login" ? "Вход в систему" : "Регистрация"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {mode === "login"
                  ? "Введите данные локальной учётной записи."
                  : "Создайте новую локальную учётную запись."}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              защищённый вход
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setApiError("");
                setMode("login");
              }}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                mode === "login"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Вход
            </button>

            <button
              type="button"
              onClick={() => {
                setApiError("");
                setMode("register");
              }}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition",
                mode === "register"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Регистрация
            </button>
          </div>

          {apiError && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-red-700">
                <TriangleAlert className="h-4 w-4" />
                {mode === "login" ? "Ошибка входа" : "Ошибка регистрации"}
              </div>
              <div className="mt-1 text-red-600">{apiError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Field
              label="Логин"
              error={errors.login?.message}
              left={<UserIcon className="h-4 w-4" />}
            >
              <input
                {...register("login", {
                  onChange: () => apiError && setApiError(""),
                })}
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="admin"
                autoComplete="username"
              />
            </Field>

            <Field
              label="Пароль"
              error={errors.password?.message}
              left={<Lock className="h-4 w-4" />}
              right={
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title={show ? "Скрыть" : "Показать"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            >
              <input
                {...register("password", {
                  onChange: () => apiError && setApiError(""),
                })}
                type={show ? "text" : "password"}
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Запомнить логин
              </label>

              <button
                type="button"
                onClick={fillAdminDemo}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950"
              >
                <KeyRound className="h-4 w-4" />
                Заполнить demo-доступ
              </button>
            </div>

            <button
              disabled={isSubmitting || booting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting || booting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}

              {isSubmitting || booting
                ? "Подготовка..."
                : mode === "login"
                  ? "Войти"
                  : "Зарегистрироваться"}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
            <span>Electron + Express + SQLite</span>
            <span className="font-mono">admin / admin</span>
          </div>
        </section>
      </div>
    </div>
  );
}