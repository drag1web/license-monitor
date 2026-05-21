import BetterSqlite3 from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import bcrypt from "bcrypt";

import type { ReportRow } from "../core/compliance.js";

type Statement = {
  run: (...args: unknown[]) => { lastInsertRowid?: number | bigint; changes?: number };
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown[];
};

export type DB = {
  exec: (sql: string) => void;
  prepare: (sql: string) => Statement;
  transaction: <T extends (...args: any[]) => any>(fn: T) => T;
};

export type UserRole = "admin" | "viewer";

export type RunStats = {
  run_at: string;
  total_products: number;
  deficit_products: number;
  expiring_products: number;
  unmatched_installs: number;
};

export type UserRow = {
  id: number;
  login: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
};

export type LicenseType = "perpetual" | "subscription" | "trial";
export type AssignmentType = "per_install" | "per_user" | "concurrent";

export type LicenseRegistryRow = {
  id: string;
  product: string;
  vendor: string | null;
  license_type: LicenseType;
  assignment_type: AssignmentType;
  seats_total: number;
  seats_used: number;
  starts_at: string | null;
  expires_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type LicenseRegistryInput = {
  id: string;
  product: string;
  vendor?: string | undefined;
  license_type: LicenseType;
  assignment_type: AssignmentType;
  seats_total: number;
  seats_used: number;
  starts_at?: string | undefined;
  expires_at?: string | undefined;
  note?: string | undefined;
};

export type ProductRow = {
  id: number;
  name: string;
  vendor: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
};

export type MappingRuleRow = {
  id: number;
  pattern: string;
  canonical_product: string;
  product_id: number | null;
  match_type: string;
  created_at: string;
  updated_at: string;
};

export type MappingRuleInput = {
  pattern: string;
  canonical_product: string;
  product_id?: number | undefined;
  match_type?: string | undefined;
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

export type ImportInput = {
  import_type: string;
  file_name?: string | undefined;
  source_path?: string | undefined;
  rows_count?: number | undefined;
  status: string;
  comment?: string | undefined;
};

export type AlertType =
  | "deficit"
  | "expiring"
  | "unmatched"
  | "pipeline_error"
  | "stale_run";

export type AlertSeverity = "info" | "warn" | "critical";

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

export type AlertInput = {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  run_id?: number | undefined;
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

export type ClientLicenseStatus = "active" | "blocked" | "expired";
export type LicenseActivationStatus = "active" | "deactivated";

export type LicenseEventType =
  | "activate_success"
  | "activate_denied"
  | "check_success"
  | "check_denied"
  | "deactivated"
  | "blocked"
  | "expired";

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
  product_id?: number | undefined;
  product_name: string;
  customer_name: string;
  status?: ClientLicenseStatus | undefined;
  expires_at?: string | undefined;
  max_activations: number;
};

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
  event_type: LicenseEventType;
  device_id: string | null;
  ip_address: string | null;
  message: string | null;
  created_at: string;
};

export type LicenseCheckReason =
  | "not_found"
  | "blocked"
  | "expired"
  | "activation_limit_exceeded"
  | "device_not_activated"
  | "deactivated"
  | "invalid_payload";

export type LicenseValidationResult =
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
    reason: LicenseCheckReason;
  };

export function initDatabase(dbPath: string): DB {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new (BetterSqlite3 as unknown as { new(p: string): DB })(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at TEXT NOT NULL,
      total_products INTEGER NOT NULL,
      deficit_products INTEGER NOT NULL,
      expiring_products INTEGER NOT NULL,
      unmatched_installs INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,

      product TEXT NOT NULL,
      product_key TEXT NOT NULL,

      license_type TEXT NOT NULL,
      demand INTEGER NOT NULL,
      installs INTEGER NOT NULL,
      users INTEGER NOT NULL,

      licenses INTEGER NOT NULL,
      delta INTEGER NOT NULL,

      risk TEXT NOT NULL,
      expires_soon TEXT NOT NULL,
      nearest_end_date TEXT,

      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_results_run_id ON results(run_id);
    CREATE INDEX IF NOT EXISTS idx_results_product_key ON results(product_key);

        CREATE TABLE IF NOT EXISTS unmatched_rows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      device TEXT NOT NULL,
      software_name TEXT NOT NULL,
      software_version TEXT,
      user TEXT,
      detected_at TEXT,
      reason TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_unmatched_rows_run_id
      ON unmatched_rows(run_id);

    CREATE INDEX IF NOT EXISTS idx_unmatched_rows_software_name
      ON unmatched_rows(software_name);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);

    CREATE TABLE IF NOT EXISTS licenses_registry (
  id TEXT PRIMARY KEY,
  product TEXT NOT NULL,
  vendor TEXT,
  license_type TEXT NOT NULL,
  assignment_type TEXT NOT NULL DEFAULT 'per_install',
  seats_total INTEGER NOT NULL DEFAULT 0 CHECK (seats_total >= 0),
  seats_used INTEGER NOT NULL DEFAULT 0 CHECK (seats_used >= 0),
  starts_at TEXT,
  expires_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

    CREATE INDEX IF NOT EXISTS idx_licenses_registry_product
      ON licenses_registry(product);

    CREATE INDEX IF NOT EXISTS idx_licenses_registry_updated_at
      ON licenses_registry(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_licenses_registry_expires_at
      ON licenses_registry(expires_at);
      CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  vendor TEXT,
  category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_name
  ON products(name);

  CREATE TABLE IF NOT EXISTS mapping_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  canonical_product TEXT NOT NULL,
  product_id INTEGER,
  match_type TEXT NOT NULL DEFAULT 'contains',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mapping_rules_pattern
  ON mapping_rules(pattern);

CREATE INDEX IF NOT EXISTS idx_mapping_rules_canonical_product
  ON mapping_rules(canonical_product);

CREATE INDEX IF NOT EXISTS idx_mapping_rules_product_id
  ON mapping_rules(product_id);

  CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_type TEXT NOT NULL,
  file_name TEXT,
  source_path TEXT,
  rows_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  comment TEXT,
  imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_imports_type
  ON imports(import_type);

CREATE INDEX IF NOT EXISTS idx_imports_imported_at
  ON imports(imported_at DESC);

  CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  run_id INTEGER,
  created_at TEXT NOT NULL,
  read_at TEXT,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at
  ON alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_is_read
  ON alerts(is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_run_id
  ON alerts(run_id);

  CREATE TABLE IF NOT EXISTS client_licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_key TEXT NOT NULL UNIQUE,
  product_id INTEGER,
  product_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT,
  max_activations INTEGER NOT NULL DEFAULT 1 CHECK (max_activations >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_client_licenses_key
  ON client_licenses(license_key);

CREATE INDEX IF NOT EXISTS idx_client_licenses_status
  ON client_licenses(status);

CREATE INDEX IF NOT EXISTS idx_client_licenses_product_id
  ON client_licenses(product_id);

CREATE TABLE IF NOT EXISTS license_activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  activated_at TEXT NOT NULL,
  last_check_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  FOREIGN KEY (license_id) REFERENCES client_licenses(id) ON DELETE CASCADE,
  UNIQUE (license_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_license_activations_license_id
  ON license_activations(license_id);

CREATE INDEX IF NOT EXISTS idx_license_activations_device_id
  ON license_activations(device_id);

CREATE INDEX IF NOT EXISTS idx_license_activations_status
  ON license_activations(status);

CREATE TABLE IF NOT EXISTS license_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id INTEGER,
  activation_id INTEGER,
  event_type TEXT NOT NULL,
  device_id TEXT,
  ip_address TEXT,
  message TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (license_id) REFERENCES client_licenses(id) ON DELETE SET NULL,
  FOREIGN KEY (activation_id) REFERENCES license_activations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_license_events_license_id
  ON license_events(license_id);

CREATE INDEX IF NOT EXISTS idx_license_events_activation_id
  ON license_events(activation_id);

CREATE INDEX IF NOT EXISTS idx_license_events_created_at
  ON license_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_license_events_event_type
  ON license_events(event_type);
  `);

  const columns = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  const hasRole = columns.some((c) => c.name === "role");

  if (!hasRole) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';`);
  }

  const licenseColumns = db
    .prepare(`PRAGMA table_info(licenses_registry)`)
    .all() as Array<{ name: string }>;

  const hasAssignmentType = licenseColumns.some((c) => c.name === "assignment_type");

  if (!hasAssignmentType) {
    db.exec(
      `ALTER TABLE licenses_registry ADD COLUMN assignment_type TEXT NOT NULL DEFAULT 'per_install';`
    );
  }

  ensureAdminUser(db);

  return db;
}

export function ensureAdminUser(db: DB) {
  const row = db
    .prepare(`SELECT id FROM users WHERE login = ?`)
    .get("admin") as { id: number } | undefined;

  if (row?.id) return;

  const password_hash = bcrypt.hashSync("admin", 10);

  db.prepare(
    `INSERT INTO users(login, password_hash, role, created_at) VALUES (?, ?, ?, ?)`
  ).run("admin", password_hash, "admin", new Date().toISOString());
}

export function findUserByLogin(db: DB, login: string): UserRow | null {
  const row = db
    .prepare(`SELECT id, login, password_hash, role, created_at FROM users WHERE login = ?`)
    .get(login) as UserRow | undefined;

  return row ?? null;
}

export function createUser(db: DB, login: string, password: string): number {
  const password_hash = bcrypt.hashSync(password, 10);

  const res = db
    .prepare(`INSERT INTO users(login, password_hash, role, created_at) VALUES (?, ?, ?, ?)`)
    .run(login, password_hash, "viewer", new Date().toISOString());

  return Number(res.lastInsertRowid);
}

export function listLicensesRegistry(db: DB): LicenseRegistryRow[] {
  return db.prepare(`
    SELECT
      id,
      product,
      vendor,
      license_type,
      assignment_type,
      seats_total,
      seats_used,
      starts_at,
      expires_at,
      note,
      created_at,
      updated_at
    FROM licenses_registry
    ORDER BY updated_at DESC, rowid DESC
  `).all() as LicenseRegistryRow[];
}

export function getLicenseRegistryById(db: DB, id: string): LicenseRegistryRow | null {
  const row = db.prepare(`
    SELECT
      id,
      product,
      vendor,
      license_type,
      assignment_type,
      seats_total,
      seats_used,
      starts_at,
      expires_at,
      note,
      created_at,
      updated_at
    FROM licenses_registry
    WHERE id = ?
  `).get(id) as LicenseRegistryRow | undefined;

  return row ?? null;
}

export function upsertLicenseRegistry(
  db: DB,
  input: LicenseRegistryInput
): LicenseRegistryRow {
  const now = new Date().toISOString();

  findOrCreateProductByName(db, {
    name: input.product,
    vendor: input.vendor,
  });

  const existing = getLicenseRegistryById(db, input.id);

  if (existing) {
    db.prepare(`
  UPDATE licenses_registry
  SET
    product = ?,
    vendor = ?,
    license_type = ?,
    assignment_type = ?,
    seats_total = ?,
    seats_used = ?,
    starts_at = ?,
    expires_at = ?,
    note = ?,
    updated_at = ?
  WHERE id = ?
`).run(
      input.product,
      input.vendor?.trim() || null,
      input.license_type,
      input.assignment_type,
      Number(input.seats_total) || 0,
      Number(input.seats_used) || 0,
      input.starts_at || null,
      input.expires_at || null,
      input.note?.trim() || null,
      now,
      input.id
    );
  } else {
    db.prepare(`
  INSERT INTO licenses_registry (
    id,
    product,
    vendor,
    license_type,
    assignment_type,
    seats_total,
    seats_used,
    starts_at,
    expires_at,
    note,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
      input.id,
      input.product,
      input.vendor?.trim() || null,
      input.license_type,
      input.assignment_type,
      Number(input.seats_total) || 0,
      Number(input.seats_used) || 0,
      input.starts_at || null,
      input.expires_at || null,
      input.note?.trim() || null,
      now,
      now
    );
  }

  const row = getLicenseRegistryById(db, input.id);
  if (!row) throw new Error("license save failed");

  return row;
}

export function removeLicenseRegistry(db: DB, id: string): { ok: true } {
  db.prepare(`DELETE FROM licenses_registry WHERE id = ?`).run(id);
  return { ok: true };
}

export function getProductByName(db: DB, name: string): ProductRow | null {
  const row = db.prepare(`
    SELECT id, name, vendor, category, created_at, updated_at
    FROM products
    WHERE name = ?
  `).get(name) as ProductRow | undefined;

  return row ?? null;
}

export function getProductById(db: DB, id: number): ProductRow | null {
  const row = db.prepare(`
    SELECT id, name, vendor, category, created_at, updated_at
    FROM products
    WHERE id = ?
  `).get(id) as ProductRow | undefined;

  return row ?? null;
}

export function listProducts(db: DB): ProductRow[] {
  return db.prepare(`
    SELECT id, name, vendor, category, created_at, updated_at
    FROM products
    ORDER BY name ASC
  `).all() as ProductRow[];
}

export function createProduct(
  db: DB,
  input: { name: string; vendor?: string | undefined; category?: string | undefined }
): ProductRow {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO products (
      name,
      vendor,
      category,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    input.name.trim(),
    input.vendor?.trim() || null,
    input.category?.trim() || null,
    now,
    now
  );

  const row = getProductByName(db, input.name.trim());
  if (!row) throw new Error("product create failed");

  return row;
}

export function updateProduct(
  db: DB,
  id: number,
  input: { name: string; vendor?: string | undefined; category?: string | undefined }
): ProductRow {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE products
    SET
      name = ?,
      vendor = ?,
      category = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    input.name.trim(),
    input.vendor?.trim() || null,
    input.category?.trim() || null,
    now,
    id
  );

  const row = getProductById(db, id);
  if (!row) throw new Error("product not found");

  return row;
}

export function removeProduct(db: DB, id: number): { ok: true } {
  db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
  return { ok: true };
}

export function findOrCreateProductByName(
  db: DB,
  input: { name: string; vendor?: string | undefined; category?: string | undefined }
): ProductRow {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new Error("product name is required");
  }

  const existing = getProductByName(db, cleanName);
  if (existing) {
    return existing;
  }

  return createProduct(db, {
    name: cleanName,
    vendor: input.vendor,
    category: input.category,
  });
}

export function listMappingRules(db: DB): MappingRuleRow[] {
  return db.prepare(`
    SELECT
      id,
      pattern,
      canonical_product,
      product_id,
      match_type,
      created_at,
      updated_at
    FROM mapping_rules
    ORDER BY id DESC
  `).all() as MappingRuleRow[];
}

export function getMappingRuleById(db: DB, id: number): MappingRuleRow | null {
  const row = db.prepare(`
    SELECT
      id,
      pattern,
      canonical_product,
      product_id,
      match_type,
      created_at,
      updated_at
    FROM mapping_rules
    WHERE id = ?
  `).get(id) as MappingRuleRow | undefined;

  return row ?? null;
}

export function createMappingRule(
  db: DB,
  input: MappingRuleInput
): MappingRuleRow {
  const now = new Date().toISOString();

  const duplicate = db.prepare(`
  SELECT id
  FROM mapping_rules
  WHERE LOWER(TRIM(pattern)) = LOWER(TRIM(?))
    AND LOWER(TRIM(match_type)) = LOWER(TRIM(?))
  LIMIT 1
`).get(input.pattern, input.match_type?.trim() || "contains") as { id: number } | undefined;

  if (duplicate) {
    throw new Error("mapping rule already exists");
  }

  db.prepare(`
    INSERT INTO mapping_rules (
      pattern,
      canonical_product,
      product_id,
      match_type,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    input.pattern.trim(),
    input.canonical_product.trim(),
    input.product_id ?? null,
    input.match_type?.trim() || "contains",
    now,
    now
  );

  const row = db.prepare(`
    SELECT
      id,
      pattern,
      canonical_product,
      product_id,
      match_type,
      created_at,
      updated_at
    FROM mapping_rules
    ORDER BY id DESC
    LIMIT 1
  `).get() as MappingRuleRow | undefined;

  if (!row) throw new Error("mapping rule create failed");

  return row;
}

export function updateMappingRule(
  db: DB,
  id: number,
  input: MappingRuleInput
): MappingRuleRow {
  const now = new Date().toISOString();

  const duplicate = db.prepare(`
  SELECT id
  FROM mapping_rules
  WHERE id <> ?
    AND LOWER(TRIM(pattern)) = LOWER(TRIM(?))
    AND LOWER(TRIM(match_type)) = LOWER(TRIM(?))
  LIMIT 1
`).get(id, input.pattern, input.match_type ?? "contains") as { id: number } | undefined;

  if (duplicate) {
    throw new Error("mapping rule already exists");
  }

  db.prepare(`
    UPDATE mapping_rules
    SET
      pattern = ?,
      canonical_product = ?,
      product_id = ?,
      match_type = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    input.pattern,
    input.canonical_product,
    input.product_id ?? null,
    input.match_type ?? "contains",
    now,
    id
  );

  const row = db
    .prepare(`SELECT * FROM mapping_rules WHERE id = ?`)
    .get(id) as MappingRuleRow | undefined;

  if (!row) {
    throw new Error("mapping rule not found");
  }

  return row;
}

export function removeMappingRule(db: DB, id: number): { ok: true } {
  db.prepare(`DELETE FROM mapping_rules WHERE id = ?`).run(id);
  return { ok: true };
}

export type MappingRuleTestResult =
  | {
    matched: true;
    rule: MappingRuleRow;
    product: ProductRow | null;
  }
  | {
    matched: false;
    rule: null;
    product: null;
  };

function matchesRule(input: string, rule: MappingRuleRow): boolean {
  const source = input.trim().toLowerCase();
  const pattern = rule.pattern.trim().toLowerCase();
  const matchType = (rule.match_type ?? "contains").trim().toLowerCase();

  if (!source || !pattern) return false;

  if (matchType === "exact") {
    return source === pattern;
  }

  if (matchType === "regex") {
    try {
      const re = new RegExp(rule.pattern, "i");
      return re.test(input);
    } catch {
      return false;
    }
  }

  return source.includes(pattern);
}

export function testMappingRules(db: DB, input: string): MappingRuleTestResult {
  const rules = listMappingRules(db);

  for (const rule of rules) {
    if (!matchesRule(input, rule)) continue;

    const product =
      rule.product_id != null ? getProductById(db, rule.product_id) : null;

    return {
      matched: true,
      rule,
      product,
    };
  }

  return {
    matched: false,
    rule: null,
    product: null,
  };
}

export function createImportLog(db: DB, input: ImportInput): number {
  const importedAt = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO imports (
      import_type,
      file_name,
      source_path,
      rows_count,
      status,
      comment,
      imported_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.import_type.trim(),
    input.file_name?.trim() || null,
    input.source_path?.trim() || null,
    Number(input.rows_count) || 0,
    input.status.trim(),
    input.comment?.trim() || null,
    importedAt
  );

  return Number(result.lastInsertRowid);
}

export function listImports(db: DB): ImportRow[] {
  return db.prepare(`
    SELECT
      id,
      import_type,
      file_name,
      source_path,
      rows_count,
      status,
      comment,
      imported_at
    FROM imports
    ORDER BY imported_at DESC, id DESC
  `).all() as ImportRow[];
}

export function deleteOldImportsKeepLast(db: DB, keepLast: number): { ok: true; deleted: number } {
  if (!Number.isFinite(keepLast) || keepLast < 0) {
    throw new Error("keepLast must be >= 0");
  }

  const ids = db.prepare(`
    SELECT id
    FROM imports
    ORDER BY imported_at DESC, id DESC
    LIMIT -1 OFFSET ?
  `).all(keepLast) as Array<{ id: number }>;

  if (!ids.length) {
    return { ok: true, deleted: 0 };
  }

  const stmt = db.prepare(`DELETE FROM imports WHERE id = ?`);
  const tx = db.transaction((rows: Array<{ id: number }>) => {
    for (const row of rows) {
      stmt.run(row.id);
    }
  });

  tx(ids);

  return { ok: true, deleted: ids.length };
}

export function createAlert(db: DB, input: AlertInput): number {
  const createdAt = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO alerts (
      type,
      severity,
      title,
      message,
      is_read,
      run_id,
      created_at,
      read_at
    )
    VALUES (?, ?, ?, ?, 0, ?, ?, NULL)
  `).run(
    input.type,
    input.severity,
    input.title.trim(),
    input.message.trim(),
    input.run_id ?? null,
    createdAt
  );

  return Number(result.lastInsertRowid);
}

export function listAlerts(db: DB, limit = 20): AlertRow[] {
  return db.prepare(`
    SELECT
      id,
      type,
      severity,
      title,
      message,
      is_read,
      run_id,
      created_at,
      read_at
    FROM alerts
    ORDER BY is_read ASC, created_at DESC, id DESC
    LIMIT ?
  `).all(limit) as AlertRow[];
}

export function getUnreadAlertsCount(db: DB): number {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM alerts
    WHERE is_read = 0
  `).get() as { cnt: number } | undefined;

  return Number(row?.cnt ?? 0);
}

export function markAlertRead(db: DB, id: number): { ok: true } {
  db.prepare(`
    UPDATE alerts
    SET
      is_read = 1,
      read_at = COALESCE(read_at, ?)
    WHERE id = ?
  `).run(new Date().toISOString(), id);

  return { ok: true };
}

export function markAllAlertsRead(db: DB): { ok: true } {
  db.prepare(`
    UPDATE alerts
    SET
      is_read = 1,
      read_at = COALESCE(read_at, ?)
    WHERE is_read = 0
  `).run(new Date().toISOString());

  return { ok: true };
}

export function deleteUnreadAlertsByType(
  db: DB,
  types: Array<"deficit" | "expiring" | "unmatched" | "pipeline_error" | "stale_run">
): { ok: true } {
  if (!types.length) return { ok: true };

  const placeholders = types.map(() => "?").join(", ");

  db.prepare(`
    DELETE FROM alerts
    WHERE is_read = 0
      AND type IN (${placeholders})
  `).run(...types);

  return { ok: true };
}

export function deleteAlert(db: DB, id: number): { ok: true } {
  db.prepare(`
    DELETE FROM alerts
    WHERE id = ?
  `).run(id);

  return { ok: true };
}

export function deleteReadAlerts(db: DB): { ok: true } {
  db.prepare(`
    DELETE FROM alerts
    WHERE is_read = 1
  `).run();

  return { ok: true };
}

export function saveRun(db: DB, stats: RunStats): number {
  const stmt = db.prepare(`
    INSERT INTO runs (
      run_at,
      total_products,
      deficit_products,
      expiring_products,
      unmatched_installs
    )
    VALUES (?, ?, ?, ?, ?)
  `);

  const res = stmt.run(
    stats.run_at,
    stats.total_products,
    stats.deficit_products,
    stats.expiring_products,
    stats.unmatched_installs
  );

  return Number(res.lastInsertRowid);
}

export function saveResults(db: DB, runId: number, report: ReportRow[]): void {
  const stmt = db.prepare(`
    INSERT INTO results (
      run_id,
      product,
      product_key,
      license_type,
      demand,
      installs,
      users,
      licenses,
      delta,
      risk,
      expires_soon,
      nearest_end_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);


  const insertMany = db.transaction((rows: ReportRow[]) => {
    for (const r of rows) {
      stmt.run(
        runId,
        r.product,
        r.product_key,
        r.license_type,
        r.demand,
        r.installs,
        r.users,
        r.licenses,
        r.delta,
        r.risk,
        r.expires_soon,
        r.nearest_end_date || null
      );
    }
  });

  insertMany(report);
}

export function saveUnmatchedRows(
  db: DB,
  runId: number,
  rows: Array<{
    device: string;
    software_name: string;
    software_version?: string | null;
    user?: string | null;
    detected_at?: string | null;
    reason: string;
  }>
): void {
  const stmt = db.prepare(`
    INSERT INTO unmatched_rows (
      run_id,
      device,
      software_name,
      software_version,
      user,
      detected_at,
      reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(
    (
      inputRows: Array<{
        device: string;
        software_name: string;
        software_version?: string | null;
        user?: string | null;
        detected_at?: string | null;
        reason: string;
      }>
    ) => {
      for (const row of inputRows) {
        stmt.run(
          runId,
          row.device,
          row.software_name,
          row.software_version ?? null,
          row.user ?? null,
          row.detected_at ?? null,
          row.reason
        );
      }
    }
  );

  insertMany(rows);
}

export function getRunUnmatchedRows(db: DB, runId: number): UnmatchedRow[] {
  return db.prepare(`
    SELECT
      id,
      run_id,
      device,
      software_name,
      software_version,
      user,
      detected_at,
      reason
    FROM unmatched_rows
    WHERE run_id = ?
    ORDER BY id ASC
  `).all(runId) as UnmatchedRow[];
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;

  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return false;

  return expires.getTime() < Date.now();
}

function normalizeLicenseKey(key: string): string {
  return String(key || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function createLicenseEvent(
  db: DB,
  input: {
    license_id?: number | null | undefined;
    activation_id?: number | null | undefined;
    event_type: LicenseEventType;
    device_id?: string | null | undefined;
    ip_address?: string | null | undefined;
    message?: string | null | undefined;
  }
): number {
  const result = db.prepare(`
    INSERT INTO license_events (
      license_id,
      activation_id,
      event_type,
      device_id,
      ip_address,
      message,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.license_id ?? null,
    input.activation_id ?? null,
    input.event_type,
    input.device_id?.trim() || null,
    input.ip_address?.trim() || null,
    input.message?.trim() || null,
    new Date().toISOString()
  );

  return Number(result.lastInsertRowid);
}

export function listClientLicenses(db: DB): ClientLicenseRow[] {
  return db.prepare(`
    SELECT
      id,
      license_key,
      product_id,
      product_name,
      customer_name,
      status,
      expires_at,
      max_activations,
      created_at,
      updated_at
    FROM client_licenses
    ORDER BY updated_at DESC, id DESC
  `).all() as ClientLicenseRow[];
}

export function getClientLicenseById(db: DB, id: number): ClientLicenseRow | null {
  const row = db.prepare(`
    SELECT
      id,
      license_key,
      product_id,
      product_name,
      customer_name,
      status,
      expires_at,
      max_activations,
      created_at,
      updated_at
    FROM client_licenses
    WHERE id = ?
  `).get(id) as ClientLicenseRow | undefined;

  return row ?? null;
}

export function getClientLicenseByKey(db: DB, licenseKey: string): ClientLicenseRow | null {
  const row = db.prepare(`
    SELECT
      id,
      license_key,
      product_id,
      product_name,
      customer_name,
      status,
      expires_at,
      max_activations,
      created_at,
      updated_at
    FROM client_licenses
    WHERE license_key = ?
  `).get(normalizeLicenseKey(licenseKey)) as ClientLicenseRow | undefined;

  return row ?? null;
}

export function createClientLicense(
  db: DB,
  input: ClientLicenseInput
): ClientLicenseRow {
  const now = new Date().toISOString();
  const licenseKey = normalizeLicenseKey(input.license_key);

  if (!licenseKey) throw new Error("license_key is required");
  if (!input.product_name.trim()) throw new Error("product_name is required");
  if (!input.customer_name.trim()) throw new Error("customer_name is required");

  const maxActivations = Math.max(1, Number(input.max_activations) || 1);

  db.prepare(`
    INSERT INTO client_licenses (
      license_key,
      product_id,
      product_name,
      customer_name,
      status,
      expires_at,
      max_activations,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    licenseKey,
    input.product_id ?? null,
    input.product_name.trim(),
    input.customer_name.trim(),
    input.status ?? "active",
    input.expires_at || null,
    maxActivations,
    now,
    now
  );

  const row = getClientLicenseByKey(db, licenseKey);
  if (!row) throw new Error("client license create failed");

  return row;
}

export function updateClientLicense(
  db: DB,
  id: number,
  input: Partial<ClientLicenseInput>
): ClientLicenseRow {
  const existing = getClientLicenseById(db, id);
  if (!existing) throw new Error("client license not found");

  const now = new Date().toISOString();

  const licenseKey =
    input.license_key !== undefined
      ? normalizeLicenseKey(input.license_key)
      : existing.license_key;

  if (!licenseKey) throw new Error("license_key is required");

  db.prepare(`
    UPDATE client_licenses
    SET
      license_key = ?,
      product_id = ?,
      product_name = ?,
      customer_name = ?,
      status = ?,
      expires_at = ?,
      max_activations = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    licenseKey,
    input.product_id !== undefined ? input.product_id : existing.product_id,
    input.product_name !== undefined ? input.product_name.trim() : existing.product_name,
    input.customer_name !== undefined ? input.customer_name.trim() : existing.customer_name,
    input.status ?? existing.status,
    input.expires_at !== undefined ? input.expires_at || null : existing.expires_at,
    input.max_activations !== undefined
      ? Math.max(1, Number(input.max_activations) || 1)
      : existing.max_activations,
    now,
    id
  );

  if (input.status === "blocked") {
    db.prepare(`
    UPDATE license_activations
    SET status = 'deactivated'
    WHERE license_id = ?
      AND status = 'active'
  `).run(id);

    createLicenseEvent(db, {
      license_id: id,
      event_type: "blocked",
      message: "license blocked by admin",
    });
  }

  const row = getClientLicenseById(db, id);
  if (!row) throw new Error("client license update failed");

  return row;
}

function getActiveActivation(
  db: DB,
  licenseId: number,
  deviceId: string
): LicenseActivationRow | null {
  const row = db.prepare(`
    SELECT
      id,
      license_id,
      device_id,
      device_name,
      activated_at,
      last_check_at,
      status
    FROM license_activations
    WHERE license_id = ?
      AND device_id = ?
    LIMIT 1
  `).get(licenseId, deviceId.trim()) as LicenseActivationRow | undefined;

  return row ?? null;
}

function countActiveActivations(db: DB, licenseId: number): number {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt
    FROM license_activations
    WHERE license_id = ?
      AND status = 'active'
  `).get(licenseId) as { cnt: number } | undefined;

  return Number(row?.cnt ?? 0);
}

export function activateLicense(
  db: DB,
  input: {
    license_key: string;
    device_id: string;
    device_name?: string | undefined;
    ip_address?: string | undefined;
  }
): LicenseValidationResult {
  const licenseKey = normalizeLicenseKey(input.license_key);
  const deviceId = input.device_id.trim();

  if (!licenseKey || !deviceId) {
    createLicenseEvent(db, {
      event_type: "activate_denied",
      device_id: deviceId || null,
      ip_address: input.ip_address,
      message: "invalid_payload",
    });

    return { ok: true, valid: false, reason: "invalid_payload" };
  }

  const license = getClientLicenseByKey(db, licenseKey);

  if (!license) {
    createLicenseEvent(db, {
      event_type: "activate_denied",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "not_found",
    });

    return { ok: true, valid: false, reason: "not_found" };
  }

  if (license.status === "blocked") {
    createLicenseEvent(db, {
      license_id: license.id,
      event_type: "activate_denied",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "blocked",
    });

    return { ok: true, valid: false, reason: "blocked" };
  }

  if (license.status === "expired" || isExpired(license.expires_at)) {
    createLicenseEvent(db, {
      license_id: license.id,
      event_type: "activate_denied",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "expired",
    });

    return { ok: true, valid: false, reason: "expired" };
  }

  const existingActivation = getActiveActivation(db, license.id, deviceId);

  if (existingActivation?.status === "active") {
    db.prepare(`
      UPDATE license_activations
      SET last_check_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), existingActivation.id);

    createLicenseEvent(db, {
      license_id: license.id,
      activation_id: existingActivation.id,
      event_type: "activate_success",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "device already activated",
    });

    return {
      ok: true,
      valid: true,
      license_id: license.id,
      activation_id: existingActivation.id,
      status: license.status,
      expires_at: license.expires_at,
    };
  }

  if (existingActivation?.status === "deactivated") {
    const activeCount = countActiveActivations(db, license.id);

    if (activeCount >= license.max_activations) {
      createLicenseEvent(db, {
        license_id: license.id,
        activation_id: existingActivation.id,
        event_type: "activate_denied",
        device_id: deviceId,
        ip_address: input.ip_address,
        message: "activation_limit_exceeded",
      });

      return { ok: true, valid: false, reason: "activation_limit_exceeded" };
    }

    const now = new Date().toISOString();

    db.prepare(`
    UPDATE license_activations
    SET
      status = 'active',
      device_name = ?,
      activated_at = ?,
      last_check_at = ?
    WHERE id = ?
  `).run(
      input.device_name?.trim() || existingActivation.device_name || null,
      now,
      now,
      existingActivation.id
    );

    createLicenseEvent(db, {
      license_id: license.id,
      activation_id: existingActivation.id,
      event_type: "activate_success",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "reactivated",
    });

    return {
      ok: true,
      valid: true,
      license_id: license.id,
      activation_id: existingActivation.id,
      status: license.status,
      expires_at: license.expires_at,
    };
  }

  const activeCount = countActiveActivations(db, license.id);

  if (activeCount >= license.max_activations) {
    createLicenseEvent(db, {
      license_id: license.id,
      event_type: "activate_denied",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "activation_limit_exceeded",
    });

    return { ok: true, valid: false, reason: "activation_limit_exceeded" };
  }

  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO license_activations (
      license_id,
      device_id,
      device_name,
      activated_at,
      last_check_at,
      status
    )
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(
    license.id,
    deviceId,
    input.device_name?.trim() || null,
    now,
    now
  );

  const activationId = Number(result.lastInsertRowid);

  createLicenseEvent(db, {
    license_id: license.id,
    activation_id: activationId,
    event_type: "activate_success",
    device_id: deviceId,
    ip_address: input.ip_address,
    message: "activated",
  });

  return {
    ok: true,
    valid: true,
    license_id: license.id,
    activation_id: activationId,
    status: license.status,
    expires_at: license.expires_at,
  };
}

export function checkLicense(
  db: DB,
  input: {
    license_key: string;
    device_id: string;
    ip_address?: string | undefined;
  }
): LicenseValidationResult {
  const licenseKey = normalizeLicenseKey(input.license_key);
  const deviceId = input.device_id.trim();

  if (!licenseKey || !deviceId) {
    createLicenseEvent(db, {
      event_type: "check_denied",
      device_id: deviceId || null,
      ip_address: input.ip_address,
      message: "invalid_payload",
    });

    return { ok: true, valid: false, reason: "invalid_payload" };
  }

  const license = getClientLicenseByKey(db, licenseKey);

  if (!license) {
    createLicenseEvent(db, {
      event_type: "check_denied",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "not_found",
    });

    return { ok: true, valid: false, reason: "not_found" };
  }

  if (license.status === "blocked") {
    createLicenseEvent(db, {
      license_id: license.id,
      event_type: "check_denied",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "blocked",
    });

    return { ok: true, valid: false, reason: "blocked" };
  }

  if (license.status === "expired" || isExpired(license.expires_at)) {
    createLicenseEvent(db, {
      license_id: license.id,
      event_type: "check_denied",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "expired",
    });

    return { ok: true, valid: false, reason: "expired" };
  }

  const activation = getActiveActivation(db, license.id, deviceId);

  if (!activation) {
    createLicenseEvent(db, {
      license_id: license.id,
      event_type: "check_denied",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "device_not_activated",
    });

    return { ok: true, valid: false, reason: "device_not_activated" };
  }

  if (activation.status === "deactivated") {
    createLicenseEvent(db, {
      license_id: license.id,
      activation_id: activation.id,
      event_type: "check_denied",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "deactivated",
    });

    return { ok: true, valid: false, reason: "deactivated" };
  }

  db.prepare(`
    UPDATE license_activations
    SET last_check_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), activation.id);

  createLicenseEvent(db, {
    license_id: license.id,
    activation_id: activation.id,
    event_type: "check_success",
    device_id: deviceId,
    ip_address: input.ip_address,
    message: "valid",
  });

  return {
    ok: true,
    valid: true,
    license_id: license.id,
    activation_id: activation.id,
    status: license.status,
    expires_at: license.expires_at,
  };
}

export function deactivateLicense(
  db: DB,
  input: {
    license_key: string;
    device_id: string;
    ip_address?: string | undefined;
  }
): { ok: true; deactivated: boolean } {
  const licenseKey = normalizeLicenseKey(input.license_key);
  const deviceId = input.device_id.trim();

  if (!licenseKey || !deviceId) {
    createLicenseEvent(db, {
      event_type: "deactivated",
      device_id: deviceId || null,
      ip_address: input.ip_address,
      message: "invalid_payload",
    });

    return { ok: true, deactivated: false };
  }

  const license = getClientLicenseByKey(db, licenseKey);

  if (!license) {
    createLicenseEvent(db, {
      event_type: "deactivated",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "license not found",
    });

    return { ok: true, deactivated: false };
  }

  const activation = getActiveActivation(db, license.id, deviceId);

  if (!activation) {
    createLicenseEvent(db, {
      license_id: license.id,
      event_type: "deactivated",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "activation not found",
    });

    return { ok: true, deactivated: false };
  }

  if (activation.status === "deactivated") {
    createLicenseEvent(db, {
      license_id: license.id,
      activation_id: activation.id,
      event_type: "deactivated",
      device_id: deviceId,
      ip_address: input.ip_address,
      message: "device already deactivated",
    });

    return { ok: true, deactivated: false };
  }

  db.prepare(`
    UPDATE license_activations
    SET status = 'deactivated'
    WHERE id = ?
  `).run(activation.id);

  createLicenseEvent(db, {
    license_id: license.id,
    activation_id: activation.id,
    event_type: "deactivated",
    device_id: deviceId,
    ip_address: input.ip_address,
    message: "device deactivated",
  });

  return { ok: true, deactivated: true };
}

export function listLicenseActivations(
  db: DB,
  licenseId: number
): LicenseActivationRow[] {
  return db.prepare(`
    SELECT
      id,
      license_id,
      device_id,
      device_name,
      activated_at,
      last_check_at,
      status
    FROM license_activations
    WHERE license_id = ?
    ORDER BY activated_at DESC, id DESC
  `).all(licenseId) as LicenseActivationRow[];
}

export function listLicenseEvents(
  db: DB,
  licenseId?: number
): LicenseEventRow[] {
  if (licenseId !== undefined) {
    return db.prepare(`
      SELECT
        id,
        license_id,
        activation_id,
        event_type,
        device_id,
        ip_address,
        message,
        created_at
      FROM license_events
      WHERE license_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 200
    `).all(licenseId) as LicenseEventRow[];
  }

  return db.prepare(`
    SELECT
      id,
      license_id,
      activation_id,
      event_type,
      device_id,
      ip_address,
      message,
      created_at
    FROM license_events
    ORDER BY created_at DESC, id DESC
    LIMIT 200
  `).all() as LicenseEventRow[];
}