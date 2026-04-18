// client/src/api.ts
// Единая точка доступа к:
// 1) HTTP API (server.ts): /api/* и /download/*
// 2) Local registry (Electron IPC): window.electron.licenses.*

/* ------------------------------------------
 * Types (Runs / Results)
 * ------------------------------------------ */

export type RunRow = {
  id: number;
  run_at: string;
  total_products: number;
  deficit_products: number;
  expiring_products: number;
  unmatched_installs: number;
};

export type ResultRow = {
  product: string;
  product_key: string;
  license_type: string;
  demand: number;
  installs: number;
  users: number;
  licenses: number;
  delta: number;
  risk: string;
  expires_soon: string;
  nearest_end_date: string | null;
};

/* ------------------------------------------
 * HTTP helper (sessions-safe)
 * ------------------------------------------ */

export type ApiOk = { ok: true };
export type ApiFail = { ok: false; error: string };
export type ApiResp<T extends object = object> = (ApiOk & T) | ApiFail;

function asErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function buildHeaders(init?: RequestInit): HeadersInit | undefined {
  const h: Record<string, string> = {};

  // прокидываем кастомные хедеры
  const inH = init?.headers;
  if (inH) {
    // init.headers может быть Headers | object | [][]
    // самый безопасный путь — скормить в Headers и потом развернуть
    const tmp = new Headers(inH as any);
    tmp.forEach((v, k) => (h[k] = v));
  }

  // если есть body и это не FormData — считаем, что JSON
  if (init?.body && !(init.body instanceof FormData)) {
    // не перетираем, если уже задано
    if (!("Content-Type" in h) && !("content-type" in h)) {
      h["Content-Type"] = "application/json";
    }
  }

  return Object.keys(h).length ? h : undefined;
}

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    // ✅ ВАЖНО: express-session работает через cookie → без include всё будет "не авторизован"
    credentials: "include",
    ...init,
    headers: buildHeaders(init),
  });

  const text = await r.text().catch(() => "");

  if (!r.ok) {
    // если сервер вернул JSON с error — вытащим
    if (text) {
      try {
        const maybe = JSON.parse(text);
        throw new Error(maybe?.error ?? maybe?.message ?? text);
      } catch {
        throw new Error(text || `HTTP ${r.status} ${r.statusText}`);
      }
    }
    throw new Error(`HTTP ${r.status} ${r.statusText}`);
  }

  // пустой ответ
  if (!text) return undefined as T;

  // обычно всё json
  try {
    return JSON.parse(text) as T;
  } catch {
    // если вдруг не json (редко) — отдадим строкой
    return text as unknown as T;
  }
}

/* ------------------------------------------
 * Runs API (HTTP)
 * ------------------------------------------ */

export function getRuns(): Promise<RunRow[]> {
  return j<RunRow[]>("/api/runs");
}

export function getRunResults(id: number): Promise<ResultRow[]> {
  return j<ResultRow[]>(`/api/runs/${id}`);
}

export function runCheck(): Promise<{ ok: boolean; runId?: number; error?: string }> {
  return j("/api/run", { method: "POST" });
}

export function deleteRun(id: number): Promise<ApiResp> {
  return j<ApiResp>(`/api/runs/${id}`, { method: "DELETE" });
}

export function deleteRunsBulk(ids: number[]): Promise<ApiResp<{ deleted: number; notFound: number }>> {
  return j(`/api/runs/bulk-delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export function cleanupKeepLast(keepLast: number, confirm?: string) {
  return j(`/api/runs/cleanup/keep-last`, {
    method: "POST",
    body: JSON.stringify({ keepLast, confirm }),
  });
}

export function cleanupOlderThan(days: number) {
  return j(`/api/runs/cleanup/older-than`, {
    method: "POST",
    body: JSON.stringify({ days }),
  });
}

export function cleanupDeleteAll(confirm: "DELETE_ALL") {
  return j(`/api/runs/cleanup/delete-all`, {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

/* ------------------------------------------
 * Downloads (HTTP)
 * ------------------------------------------ */

export const download = {
  xlsx: "/download/report.xlsx",
  reportCsv: "/download/report.csv",
  runsCsv: "/download/runs.csv",
  unmatchedCsv: "/download/unmatched.csv",
  badRowsCsv: "/download/bad_rows.csv",
} as const;

/* ------------------------------------------
 * Auth API (HTTP)
 * ------------------------------------------ */

export type User = { id: number; login: string; role: "admin" | "viewer" };

export function me(): Promise<{ ok: boolean; user: User | null }> {
  return j("/api/auth/me");
}

export function login(login: string, password: string) {
  return j<{ ok: boolean; user?: User; error?: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });
}

export function register(login: string, password: string) {
  return j<{ ok: boolean; user?: User; error?: string }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ login, password }),
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return j<{ ok: boolean; error?: string }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function logout() {
  return j<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

/* ------------------------------------------
 * Licenses registry (Electron IPC)
 * ------------------------------------------ */

export type LicenseType = "perpetual" | "subscription" | "trial";

export type LicenseRow = {
  id: string;
  product: string;
  vendor?: string;
  license_type: LicenseType;
  seats_total: number;
  seats_used: number;
  starts_at?: string;
  expires_at?: string;
  note?: string;
  updated_at?: string;
};

function normalizeRow(r: LicenseRow): LicenseRow {
  return {
    ...r,
    vendor: r.vendor ?? "",
    note: r.note ?? "",
    starts_at: r.starts_at ?? "",
    expires_at: r.expires_at ?? "",
    seats_total: Number.isFinite(Number(r.seats_total)) ? Number(r.seats_total) : 0,
    seats_used: Number.isFinite(Number(r.seats_used)) ? Number(r.seats_used) : 0,
  };
}

export async function getLicenses(): Promise<LicenseRow[]> {
  const rows = await j<LicenseRow[]>("/api/licenses");
  return (rows ?? []).map(normalizeRow);
}

export async function upsertLicense(row: LicenseRow): Promise<LicenseRow> {
  if (!row?.id) throw new Error("upsertLicense: row.id required");
  if (!row?.product) throw new Error("upsertLicense: product required");
  if (!row?.license_type) throw new Error("upsertLicense: license_type required");

  const payload = normalizeRow(row);

  try {
    return await j<LicenseRow>("/api/licenses/upsert", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error(asErrorMessage(e));
  }
}

export async function removeLicense(id: string): Promise<{ ok: boolean }> {
  if (!id) return { ok: false };

  try {
    return await j<{ ok: boolean }>(`/api/licenses/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch (e) {
    throw new Error(asErrorMessage(e));
  }
}

/* ------------------------------------------
 * Optional: TS declarations for window.electron
 * ------------------------------------------ */

declare global {
  interface Window {
    electron?: {
      window?: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
      };
    };
  }
}
