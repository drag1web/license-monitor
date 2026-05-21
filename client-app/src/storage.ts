import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";

const LICENSE_FILE = path.resolve(process.cwd(), "license.json");

export type StoredLicense = {
  license_key: string;
  activated_at?: string;
};

export function readStoredLicense(): StoredLicense | null {
  if (!existsSync(LICENSE_FILE)) return null;

  try {
    const raw = readFileSync(LICENSE_FILE, "utf-8");
    const data = JSON.parse(raw) as Partial<StoredLicense>;

    if (!data.license_key?.trim()) return null;

    return {
      license_key: data.license_key.trim(),
      activated_at: data.activated_at,
    };
  } catch {
    return null;
  }
}

export function saveStoredLicense(licenseKey: string): void {
  writeFileSync(
    LICENSE_FILE,
    JSON.stringify(
      {
        license_key: licenseKey.trim(),
        activated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

export function removeStoredLicense(): void {
  if (existsSync(LICENSE_FILE)) {
    rmSync(LICENSE_FILE);
  }
}