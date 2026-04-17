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
  created_at: string;
};

export function initDatabase(dbPath: string): DB {
  mkdirSync(dirname(dbPath), { recursive: true });

  // better-sqlite3 — default export это функция-конструктор
  const db = new (BetterSqlite3 as unknown as { new (p: string): DB })(dbPath);

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

    -- AUTH
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
  `);

  // на всякий: создадим admin/admin при первом запуске
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
    `INSERT INTO users(login, password_hash, created_at) VALUES (?, ?, ?)`
  ).run("admin", password_hash, new Date().toISOString());
}

export function findUserByLogin(db: DB, login: string): UserRow | null {
  const row = db
    .prepare(`SELECT id, login, password_hash, created_at FROM users WHERE login = ?`)
    .get(login) as UserRow | undefined;

  return row ?? null;
}

export function createUser(db: DB, login: string, password: string): number {
  const password_hash = bcrypt.hashSync(password, 10);
  const res = db
    .prepare(`INSERT INTO users(login, password_hash, created_at) VALUES(?, ?, ?)`)
    .run(login, password_hash, new Date().toISOString());

  return Number(res.lastInsertRowid);
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
