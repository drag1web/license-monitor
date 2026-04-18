import { existsSync, renameSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  type DB,
  getLicenseRegistryById,
  upsertLicenseRegistry,
  type LicenseRegistryInput,
} from "./database.js";

type JsonLicenseRow = {
  id?: unknown;
  product?: unknown;
  vendor?: unknown;
  license_type?: unknown;
  seats_total?: unknown;
  seats_used?: unknown;
  starts_at?: unknown;
  expires_at?: unknown;
  note?: unknown;
  updated_at?: unknown;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isLicenseType(v: string): v is "perpetual" | "subscription" | "trial" {
  return v === "perpetual" || v === "subscription" || v === "trial";
}

function normalizeJsonRow(row: JsonLicenseRow): LicenseRegistryInput | null {
  const id = asString(row.id).trim();
  const product = asString(row.product).trim();
  const license_type_raw = asString(row.license_type).trim();

  if (!id || !product || !isLicenseType(license_type_raw)) {
    return null;
  }

  return {
    id,
    product,
    vendor: asString(row.vendor).trim(),
    license_type: license_type_raw,
    seats_total: asNumber(row.seats_total),
    seats_used: asNumber(row.seats_used),
    starts_at: asString(row.starts_at).trim(),
    expires_at: asString(row.expires_at).trim(),
    note: asString(row.note).trim(),
  };
}

export async function migrateLicensesJsonToRegistry(
  db: DB,
  jsonPath: string
): Promise<{ migrated: number; skipped: number; backupPath: string | null }> {
  if (!existsSync(jsonPath)) {
    return { migrated: 0, skipped: 0, backupPath: null };
  }

  const raw = await readFile(jsonPath, "utf-8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Не удалось распарсить JSON: ${jsonPath}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Ожидался массив в файле: ${jsonPath}`);
  }

  let migrated = 0;
  let skipped = 0;

  for (const item of parsed as JsonLicenseRow[]) {
    const normalized = normalizeJsonRow(item);

    if (!normalized) {
      skipped++;
      continue;
    }

    const existing = getLicenseRegistryById(db, normalized.id);
    if (existing) {
      skipped++;
      continue;
    }

    upsertLicenseRegistry(db, normalized);
    migrated++;
  }

  const backupDir = path.dirname(jsonPath);
  await mkdir(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, "licenses.migrated.backup.json");
  renameSync(jsonPath, backupPath);

  return { migrated, skipped, backupPath };
}