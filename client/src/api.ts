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

export type AlertSeverity = "info" | "warn" | "critical";
export type AlertType =
  | "deficit"
  | "expiring"
  | "unmatched"
  | "pipeline_error"
  | "stale_run";

export type AlertRow = {
  id: number;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  is_read: number;
  run_id: number | null;
  created_at: string;
  read_at: string | null;
};

export type ImportRow = {
  id: number;
  import_type: string;
  file_name: string | null;
  source_path: string | null;
  rows_count: number;
  status: string;
  comment: string | null;
  imported_at: string;
};

export type ProductRow = {
  id: number;
  name: string;
  vendor: string | null;
  category: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreateProductInput = {
  name: string;
  vendor?: string;
  category?: string;
};

export type UpdateProductInput = {
  name: string;
  vendor?: string;
  category?: string;
};

export type MappingRuleRow = {
  id: number;
  pattern: string;
  match_type: string | null;
  product_id: number | null;
  canonical_product?: string | null;
  product_name?: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CreateMappingRuleInput = {
  pattern: string;
  canonical_product: string;
  product_id?: number;
  match_type?: string;
};

export type UpdateMappingRuleInput = {
  pattern: string;
  canonical_product: string;
  product_id?: number;
  match_type?: string;
};

export type MappingRuleTestResponse =
  | {
    ok: true;
    matched: true;
    rule: MappingRuleRow;
    product: ProductRow | null;
  }
  | {
    ok: true;
    matched: false;
    rule: null;
    product: null;
  }
  | {
    ok: false;
    error: string;
  };

export type UnmatchedRow = {
  id: number;
  run_id: number;
  device: string;
  software_name: string;
  software_version: string | null;
  user: string | null;
  detected_at: string | null;
  reason: string;
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

export function getRunUnmatched(id: number): Promise<UnmatchedRow[]> {
  return j<UnmatchedRow[]>(`/api/runs/${id}/unmatched`);
}

export function runCheck(): Promise<{ ok: boolean; runId?: number; error?: string }> {
  return j("/api/run", { method: "POST" });
}

export function getAlerts(limit = 20): Promise<{ items: AlertRow[]; unread: number }> {
  return j(`/api/alerts?limit=${encodeURIComponent(String(limit))}`);
}

export function readAlert(id: number): Promise<{ ok: true }> {
  return j(`/api/alerts/${id}/read`, { method: "POST" });
}

export function readAllAlerts(): Promise<{ ok: true }> {
  return j(`/api/alerts/read-all`, { method: "POST" });
}

export function deleteAlertById(id: number): Promise<{ ok: true }> {
  return j(`/api/alerts/${id}`, { method: "DELETE" });
}

export function deleteReadAlerts(): Promise<{ ok: true }> {
  return j(`/api/alerts/read`, { method: "DELETE" });
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

export function cleanupImportsKeepLast(keepLast: number) {
  return j<{ ok: boolean; deleted?: number; error?: string }>("/api/imports/cleanup/keep-last", {
    method: "POST",
    body: JSON.stringify({ keepLast }),
  });
}

export function getImports(): Promise<ImportRow[]> {
  return j<ImportRow[]>("/api/imports");
}

export function getProducts(): Promise<ProductRow[]> {
  return j<ProductRow[]>("/api/products");
}

export function createProduct(input: CreateProductInput): Promise<ProductRow> {
  return j<ProductRow>("/api/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProduct(id: number, input: UpdateProductInput): Promise<ProductRow> {
  return j<ProductRow>(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteProduct(id: number): Promise<{ ok: boolean }> {
  return j<{ ok: boolean }>(`/api/products/${id}`, {
    method: "DELETE",
  });
}

export function getMappingRules(): Promise<MappingRuleRow[]> {
  return j<MappingRuleRow[]>("/api/mapping-rules");
}

export function createMappingRule(input: CreateMappingRuleInput): Promise<MappingRuleRow> {
  return j<MappingRuleRow>("/api/mapping-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMappingRule(id: number, input: UpdateMappingRuleInput): Promise<MappingRuleRow> {
  return j<MappingRuleRow>(`/api/mapping-rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteMappingRule(id: number): Promise<{ ok: boolean }> {
  return j<{ ok: boolean }>(`/api/mapping-rules/${id}`, {
    method: "DELETE",
  });
}

export function testMappingRule(input: string): Promise<MappingRuleTestResponse> {
  return j<MappingRuleTestResponse>("/api/mapping-rules/test", {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

export async function uploadImport(
  importType: "installations" | "licenses" | "mapping",
  file: File
): Promise<{ ok: boolean; file_name?: string; saved_as?: string; path?: string; error?: string }> {
  const form = new FormData();
  form.append("import_type", importType);
  form.append("file", file);

  return j("/api/imports/upload", {
    method: "POST",
    body: form,
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
 * Server-side client licensing API (HTTP)
 * ------------------------------------------ */

export type ClientLicenseStatus = "active" | "blocked" | "expired";
export type LicenseActivationStatus = "active" | "deactivated";

export type ClientLicenseRow = {
  id: number;
  license_key: string;
  product_id: number | null;
  product_name: string;
  customer_name: string;
  status: ClientLicenseStatus;
  expires_at: string | null;
  max_activations: number;
  created_at: string;
  updated_at: string;
};

export type ClientLicenseInput = {
  license_key: string;
  product_id?: number;
  product_name: string;
  customer_name: string;
  status?: ClientLicenseStatus;
  expires_at?: string;
  max_activations: number;
};

export type UpdateClientLicenseInput = Partial<ClientLicenseInput>;

export type LicenseActivationRow = {
  id: number;
  license_id: number;
  device_id: string;
  device_name: string | null;
  activated_at: string;
  last_check_at: string | null;
  status: LicenseActivationStatus;
};

export type LicenseEventRow = {
  id: number;
  license_id: number | null;
  activation_id: number | null;
  event_type: string;
  device_id: string | null;
  ip_address: string | null;
  message: string | null;
  created_at: string;
};

export type LicenseValidationResponse =
  | {
    ok: true;
    valid: true;
    license_id: number;
    activation_id: number;
    status: ClientLicenseStatus;
    expires_at: string | null;
  }
  | {
    ok: true;
    valid: false;
    reason:
    | "not_found"
    | "blocked"
    | "expired"
    | "activation_limit_exceeded"
    | "device_not_activated"
    | "deactivated"
    | "invalid_payload";
  };

export function getClientLicenses(): Promise<ClientLicenseRow[]> {
  return j<ClientLicenseRow[]>("/api/client-licenses");
}

export function createClientLicense(input: ClientLicenseInput): Promise<ClientLicenseRow> {
  return j<ClientLicenseRow>("/api/client-licenses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateClientLicense(
  id: number,
  input: UpdateClientLicenseInput
): Promise<ClientLicenseRow> {
  return j<ClientLicenseRow>(`/api/client-licenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function getLicenseActivations(licenseId: number): Promise<LicenseActivationRow[]> {
  return j<LicenseActivationRow[]>(`/api/client-licenses/${licenseId}/activations`);
}

export function getLicenseEvents(licenseId: number): Promise<LicenseEventRow[]> {
  return j<LicenseEventRow[]>(`/api/client-licenses/${licenseId}/events`);
}

export function getAllLicenseEvents(): Promise<LicenseEventRow[]> {
  return j<LicenseEventRow[]>("/api/license-events");
}

export function activateClientLicense(input: {
  license_key: string;
  device_id: string;
  device_name?: string;
}): Promise<LicenseValidationResponse> {
  return j<LicenseValidationResponse>("/api/license/activate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function checkClientLicense(input: {
  license_key: string;
  device_id: string;
}): Promise<LicenseValidationResponse> {
  return j<LicenseValidationResponse>("/api/license/check", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deactivateClientLicense(input: {
  license_key: string;
  device_id: string;
}): Promise<{ ok: true; deactivated: boolean }> {
  return j<{ ok: true; deactivated: boolean }>("/api/license/deactivate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

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
export type AssignmentType = "per_install" | "per_user" | "concurrent";

export type LicenseRow = {
  id: string;
  product: string;
  vendor?: string;
  license_type: LicenseType;
  assignment_type: AssignmentType;
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
    license_type: (r.license_type ?? "perpetual") as LicenseType,
    assignment_type: (r.assignment_type ?? "per_install") as AssignmentType,
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
  if (!row?.assignment_type) throw new Error("upsertLicense: assignment_type required");

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
