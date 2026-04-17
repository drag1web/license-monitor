import type { InstallationRow, LicenseRow } from "./compliance.js";

export type BadRow = {
  source: "installations" | "licenses" | "mapping";
  row_json: string;
  reason: string;
};

export function validateInstallations(rows: InstallationRow[]): {
  good: InstallationRow[];
  bad: BadRow[];
} {
  const good: InstallationRow[] = [];
  const bad: BadRow[] = [];

  for (const r of rows) {
    const reasons: string[] = [];

    if (!r.device || String(r.device).trim() === "") reasons.push("device пустой");
    if (!r.software_name || String(r.software_name).trim() === "")
      reasons.push("software_name пустой");

    if (r.detected_at && !isIsoDate(r.detected_at))
      reasons.push("detected_at не YYYY-MM-DD");

    if (reasons.length) {
      bad.push({
        source: "installations",
        row_json: JSON.stringify(r),
        reason: reasons.join("; "),
      });
    } else {
      good.push(r);
    }
  }

  return { good, bad };
}

export function validateLicenses(rows: LicenseRow[]): {
  good: LicenseRow[];
  bad: BadRow[];
} {
  const good: LicenseRow[] = [];
  const bad: BadRow[] = [];

  for (const r of rows) {
    const reasons: string[] = [];

    if (!r.product_name || String(r.product_name).trim() === "")
      reasons.push("product_name пустой");

    const n = Number(r.count);
    if (!Number.isFinite(n)) reasons.push("count не число");
    if (Number.isFinite(n) && n < 0) reasons.push("count отрицательный");

    if (r.end_date && !isIsoDate(r.end_date))
      reasons.push("end_date не YYYY-MM-DD");

    if (reasons.length) {
      bad.push({
        source: "licenses",
        row_json: JSON.stringify(r),
        reason: reasons.join("; "),
      });
    } else {
      good.push(r);
    }
  }

  return { good, bad };
}

function isIsoDate(s: string): boolean {
  // простая проверка формата YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}
