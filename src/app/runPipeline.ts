import { readCsv } from "../io/readCsv.js";
import { writeCsv } from "../report/writeReportCsv.js";
import { writeReportXlsx } from "../report/writeReportXlsx.js";
import { buildRules } from "../core/mapping.js";
import { buildReport, type InstallationRow, type LicenseRow } from "../core/compliance.js";
import { validateInstallations, validateLicenses } from "../core/validate.js";
import {
  initDatabase,
  saveRun,
  saveResults,
  saveUnmatchedRows,
  createImportLog,
  createAlert,
  deleteUnreadAlertsByType,
  listMappingRules,
  listLicensesRegistry,
} from "../db/database.js";

export type Config = {
  installationsPath: string;
  licensesPath: string;
  mappingPath: string;

  reportPath: string;
  unmatchedPath: string;
  badRowsPath: string;
  xlsxReportPath: string;

  dbPath: string;
  runsCsvPath: string;

  expiresDays: number;
  legacyLicensesJsonPath?: string;
};

type CsvMappingRow = {
  pattern: string;
  canonical_product: string;
  match_type?: string | null;
};

function registryToPipelineLicenses(
  rows: ReturnType<typeof listLicensesRegistry>
): LicenseRow[] {
  return rows.map((row) => ({
    product_name: row.product,
    license_type: row.license_type,
    count: String(
      Math.max(
        0,
        (Number(row.seats_total) || 0) - (Number(row.seats_used) || 0)
      )
    ),
    end_date: row.expires_at || "",
  }));
}

export async function runPipeline(config: Config): Promise<{ runId: number }> {
  const db = initDatabase(config.dbPath);

  // 1) load installations
  let installsRaw: InstallationRow[] = [];

  try {
    installsRaw = await readCsv<InstallationRow>(config.installationsPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    createImportLog(db, {
      import_type: "installations",
      file_name: "installations.csv",
      source_path: config.installationsPath,
      rows_count: 0,
      status: "failed",
      comment: `csv read error: ${msg}`,
    });

    throw e;
  }

  // 2) load licenses from DB registry
  let licensesRaw: LicenseRow[] = [];

  try {
    const registryRows = listLicensesRegistry(db);
    licensesRaw = registryToPipelineLicenses(registryRows);

    createImportLog(db, {
      import_type: "licenses",
      file_name: "licenses_registry",
      source_path: "sqlite:licenses_registry",
      rows_count: registryRows.length,
      status: "success",
      comment: `loaded from registry: ${registryRows.length}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    createImportLog(db, {
      import_type: "licenses",
      file_name: "licenses_registry",
      source_path: "sqlite:licenses_registry",
      rows_count: 0,
      status: "failed",
      comment: `registry read error: ${msg}`,
    });

    throw e;
  }

  // 3) validate
  const vi = validateInstallations(installsRaw);
  const vl = validateLicenses(licensesRaw);

  createImportLog(db, {
    import_type: "installations",
    file_name: "installations.csv",
    source_path: config.installationsPath,
    rows_count: installsRaw.length,
    status: vi.bad.length > 0 ? "partial" : "success",
    comment:
      vi.bad.length > 0
        ? `valid: ${vi.good.length}, bad: ${vi.bad.length}`
        : `validated: ${vi.good.length}/${installsRaw.length}`,
  });

  createImportLog(db, {
    import_type: "licenses",
    file_name: "licenses_registry",
    source_path: "sqlite:licenses_registry",
    rows_count: licensesRaw.length,
    status: vl.bad.length > 0 ? "partial" : "success",
    comment:
      vl.bad.length > 0
        ? `valid: ${vl.good.length}, bad: ${vl.bad.length}`
        : `validated: ${vl.good.length}/${licensesRaw.length}`,
  });

  if (vi.bad.length || vl.bad.length) {
    const badRows = [...vi.bad, ...vl.bad];
    await writeCsv(
      config.badRowsPath,
      ["source", "reason", "row_json"],
      badRows.map((b) => [b.source, b.reason, b.row_json])
    );
  }

  // 4) mapping: CSV + DB rules
  let mappingRows: CsvMappingRow[] = [];

  try {
    mappingRows = await readCsv<CsvMappingRow>(config.mappingPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    createImportLog(db, {
      import_type: "mapping",
      file_name: "mapping.csv",
      source_path: config.mappingPath,
      rows_count: 0,
      status: "failed",
      comment: `csv read error: ${msg}`,
    });

    throw e;
  }

  const dbMappingRows = listMappingRules(db).map((r) => ({
    pattern: r.pattern,
    canonical_product: r.canonical_product,
    match_type: r.match_type,
  }));

  const mergedMappingRows = [...dbMappingRows, ...mappingRows];
  const rules = buildRules(mergedMappingRows);

  createImportLog(db, {
    import_type: "mapping",
    file_name: "mapping.csv",
    source_path: config.mappingPath,
    rows_count: mappingRows.length,
    status: "success",
    comment: `csv rules: ${mappingRows.length}, db rules: ${dbMappingRows.length}, merged: ${mergedMappingRows.length}`,
  });

  // 5) report
  const { report, unmatched } = buildReport(vi.good, vl.good, rules, config.expiresDays);

  // 6) CSV outputs
  await writeCsv(
    config.reportPath,
    [
      "product",
      "product_key",
      "license_type",
      "demand",
      "installs",
      "users",
      "licenses",
      "delta",
      "risk",
      "expires_soon",
      "nearest_end_date",
    ],
    report.map((r) => [
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
      r.nearest_end_date,
    ])
  );

  await writeCsv(
    config.unmatchedPath,
    ["device", "software_name", "software_version", "user", "detected_at", "reason"],
    unmatched.map((u) => [
      u.device,
      u.software_name,
      u.software_version ?? "",
      u.user ?? "",
      u.detected_at ?? "",
      u.reason,
    ])
  );

  // 7) Excel
  await writeReportXlsx(config.xlsxReportPath, report, unmatched, config.expiresDays);

  // 8) DB
  const deficitCount = report.filter((r) => r.risk === "DEFICIT").length;
  const expiringCount = report.filter((r) => r.expires_soon === "YES").length;
  const unmatchedCount = unmatched.length;

  const runAt = new Date().toISOString();

  const saveRunTransaction = db.transaction(() => {
    const nextRunId = saveRun(db, {
      run_at: runAt,
      total_products: report.length,
      deficit_products: deficitCount,
      expiring_products: expiringCount,
      unmatched_installs: unmatchedCount,
    });

    saveResults(db, nextRunId, report);
    saveUnmatchedRows(db, nextRunId, unmatched);

    return nextRunId;
  });

  const runId = saveRunTransaction();

  // Не удаляем старые уведомления автоматически.
  // Иначе пользователь теряет историю проблем между запусками.
  // deleteUnreadAlertsByType(db, ["deficit", "expiring", "unmatched"]);

  if (deficitCount > 0) {
    createAlert(db, {
      type: "deficit",
      severity: "critical",
      title: "Обнаружен дефицит лицензий",
      message: `Найдено ${deficitCount} продуктов с нехваткой лицензий.`,
      run_id: runId,
    });
  }

  if (expiringCount > 0) {
    createAlert(db, {
      type: "expiring",
      severity: "warn",
      title: "Есть лицензии с истекающим сроком",
      message: `Обнаружено ${expiringCount} продуктов, у которых лицензии скоро истекают.`,
      run_id: runId,
    });
  }

  if (unmatchedCount > 0) {
    createAlert(db, {
      type: "unmatched",
      severity: "warn",
      title: "Есть несопоставленные установки",
      message: `Найдено ${unmatchedCount} установок без сопоставления.`,
      run_id: runId,
    });
  }

  return { runId };
}