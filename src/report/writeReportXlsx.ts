import ExcelJS from "exceljs";
import type { ReportRow, UnmatchedRow } from "../core/compliance.js";

export async function writeReportXlsx(
  path: string,
  report: ReportRow[],
  unmatched: UnmatchedRow[],
  expiresDays: number
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "license-monitor";
  wb.created = new Date();

  // ===== helpers =====
  const autoWidth = (ws: ExcelJS.Worksheet) => {
    const widths: number[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const v = cell.value;
        const text =
          v === null || v === undefined
            ? ""
            : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
        widths[col] = Math.max(widths[col] ?? 10, Math.min(60, text.length + 2));
      });
    });
    ws.columns?.forEach((c, i) => (c.width = Math.max(10, widths[i + 1] ?? 10)));
  };

  const addTableHeader = (ws: ExcelJS.Worksheet, headers: string[]) => {
    const row = ws.addRow(headers);
    row.font = { bold: true };
    row.alignment = { vertical: "middle" };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  // ===== split sets =====
  const deficit = report.filter((r) => r.risk === "DEFICIT");
  const expiring = report.filter((r) => r.expires_soon === "YES");

  // ===== Summary =====
  const wsSummary = wb.addWorksheet("Summary");

  const totalProducts = report.length;
  const deficitCount = deficit.length;
  const expiringCount = expiring.length;
  const totalDeficitLicenses = deficit.reduce((sum, r) => sum + r.delta, 0); // delta > 0
  const totalUnusedLicenses = report
    .filter((r) => r.delta < 0)
    .reduce((sum, r) => sum + Math.abs(r.delta), 0);

  wsSummary.addRow(["Параметр", "Значение"]);
  wsSummary.getRow(1).font = { bold: true };
  wsSummary.views = [{ state: "frozen", ySplit: 1 }];

  wsSummary.addRow(["Всего продуктов (после сопоставления)", totalProducts]);
  wsSummary.addRow(["Продуктов с дефицитом", deficitCount]);
  wsSummary.addRow([`Продуктов с истечением ≤ ${expiresDays} дней`, expiringCount]);
  wsSummary.addRow(["Суммарный дефицит лицензий (шт.)", totalDeficitLicenses]);
  wsSummary.addRow(["Суммарный излишек лицензий (шт.)", totalUnusedLicenses]);
  wsSummary.addRow(["Не сопоставленных установок", unmatched.length]);

  autoWidth(wsSummary);

  // ===== All =====
  const wsAll = wb.addWorksheet("All");
  addTableHeader(wsAll, [
    "product",
    "product_key",
    "installs",
    "licenses",
    "delta",
    "risk",
    "expires_soon",
    "nearest_end_date",
  ]);

  for (const r of report) {
    wsAll.addRow([
      r.product,
      r.product_key,
      r.installs,
      r.licenses,
      r.delta,
      r.risk,
      r.expires_soon,
      r.nearest_end_date,
    ]);
  }
  autoWidth(wsAll);

  // ===== Deficit =====
  const wsDef = wb.addWorksheet("Deficit");
  addTableHeader(wsDef, ["product", "installs", "licenses", "delta"]);
  for (const r of deficit) {
    wsDef.addRow([r.product, r.installs, r.licenses, r.delta]);
  }
  autoWidth(wsDef);

  // ===== Expiring =====
  const wsExp = wb.addWorksheet("Expiring");
  addTableHeader(wsExp, ["product", "nearest_end_date", "expires_soon"]);
  for (const r of expiring) {
    wsExp.addRow([r.product, r.nearest_end_date, r.expires_soon]);
  }
  autoWidth(wsExp);

  // ===== Unmatched =====
  const wsUn = wb.addWorksheet("Unmatched");
  addTableHeader(wsUn, [
    "device",
    "software_name",
    "software_version",
    "user",
    "detected_at",
    "reason",
  ]);

  for (const u of unmatched) {
    wsUn.addRow([
      u.device,
      u.software_name,
      u.software_version ?? "",
      u.user ?? "",
      u.detected_at ?? "",
      u.reason,
    ]);
  }
  autoWidth(wsUn);

  await wb.xlsx.writeFile(path);
}
