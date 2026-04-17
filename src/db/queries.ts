import type { DB } from "./database.js";

/* ------------------------------------------
 * Types
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
 * Queries
 * ------------------------------------------ */

export function getLastRuns(db: DB, limit = 50): RunRow[] {
  const stmt = db.prepare(`
    SELECT
      r.id,
      r.run_at,
      r.total_products,

      -- дефициты считаем по results
      (SELECT COUNT(*)
       FROM results x
       WHERE x.run_id = r.id AND x.risk = 'DEFICIT') AS deficit_products,

      -- истекающие считаем по results
      (SELECT COUNT(*)
       FROM results x
       WHERE x.run_id = r.id AND x.expires_soon = 'YES') AS expiring_products,

      -- unmatched пока оставляем как есть (если это отдельная логика вне results)
      r.unmatched_installs
    FROM runs r
    ORDER BY r.id DESC
    LIMIT ?
  `);

  return stmt.all(limit) as RunRow[];
}

export function getRunResults(db: DB, runId: number): ResultRow[] {
  const stmt = db.prepare(`
    SELECT
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
    FROM results
    WHERE run_id = ?
    ORDER BY
      CASE WHEN risk = 'DEFICIT' THEN 0 ELSE 1 END,
      CASE WHEN expires_soon = 'YES' THEN 0 ELSE 1 END,
      delta DESC
  `);

  return stmt.all(runId) as ResultRow[];
}

/* ------------------------------------------
 * Mutations
 * ------------------------------------------ */

export function deleteRun(db: DB, runId: number) {
  const tx = db.transaction((id: number) => {
    // удалить результаты запуска
    db.prepare(`
      DELETE FROM results
      WHERE run_id = ?
    `).run(id);

    // удалить сам run
    const res = db.prepare(`
      DELETE FROM runs
      WHERE id = ?
    `).run(id);

    if (res.changes === 0) {
      throw new Error("run not found");
    }
  });

  tx(runId);
  return { ok: true };
}

export function deleteRuns(db: DB, ids: number[]) {
  const clean = Array.from(new Set(ids))
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (clean.length === 0) return { ok: true, deleted: 0, notFound: 0 };

  const delResults = db.prepare(`DELETE FROM results WHERE run_id = ?`);
  const delRun = db.prepare(`DELETE FROM runs WHERE id = ?`);

  const tx = db.transaction((arr: number[]) => {
    let deleted = 0;
    let notFound = 0;

    for (const id of arr) {
      delResults.run(id);
      const res = delRun.run(id);
      if (res.changes === 0) notFound++;
      else deleted++;
    }

    return { ok: true, deleted, notFound };
  });

  return tx(clean);
}

/**
 * Удалить все runs кроме последних keepN (по id DESC).
 */
export function deleteRunsKeepLast(db: DB, keepN: number) {
  const keep = Number(keepN);
  if (!Number.isFinite(keep) || keep < 0) throw new Error("bad keepN");

  // если keep=0 — удаляем вообще всё
  const idsToKeep = db
    .prepare(`SELECT id FROM runs ORDER BY id DESC LIMIT ?`)
    .all(keep) as Array<{ id: number }>;

  const keepIds = new Set(idsToKeep.map((x) => x.id));

  const allIds = db.prepare(`SELECT id FROM runs`).all() as Array<{ id: number }>;
  const delIds = allIds.map((x) => x.id).filter((id) => !keepIds.has(id));

  return deleteRuns(db, delIds);
}

/**
 * Удалить runs старше N дней по run_at (ISO строка).
 * run_at у тебя ISO -> сравнение по строке работает корректно, но делаем cutoff ISO.
 */
export function deleteRunsOlderThanDays(db: DB, days: number) {
  const d = Number(days);
  if (!Number.isFinite(d) || d < 0) throw new Error("bad days");

  const cutoff = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

  const ids = db
    .prepare(`SELECT id FROM runs WHERE run_at < ?`)
    .all(cutoff) as Array<{ id: number }>;

  return deleteRuns(db, ids.map((x) => x.id));
}

/**
 * Удалить ВСЕ runs.
 */
export function deleteAllRuns(db: DB) {
  const ids = db.prepare(`SELECT id FROM runs`).all() as Array<{ id: number }>;
  return deleteRuns(db, ids.map((x) => x.id));
}
