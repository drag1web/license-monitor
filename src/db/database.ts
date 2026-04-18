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

export type LicenseRegistryRow = {
  id: string;
  product: string;
  vendor: string | null;
  license_type: LicenseType;
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
  `);

  const columns = db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  const hasRole = columns.some((c) => c.name === "role");

  if (!hasRole) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';`);
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
        seats_total,
        seats_used,
        starts_at,
        expires_at,
        note,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.product,
      input.vendor?.trim() || null,
      input.license_type,
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

export function removeMappingRule(db: DB, id: number): { ok: true } {
  db.prepare(`DELETE FROM mapping_rules WHERE id = ?`).run(id);
  return { ok: true };
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