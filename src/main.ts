import { readFile } from "node:fs/promises";
import { readCsv } from "./io/readCsv.js";
import { createLogger } from "./io/logger.js";
import { writeCsv } from "./report/writeReportCsv.js";
import { writeReportXlsx } from "./report/writeReportXlsx.js";

import { buildRules } from "./core/mapping.js";
import {
  buildReport,
  type InstallationRow,
  type LicenseRow,
} from "./core/compliance.js";
import { validateInstallations, validateLicenses } from "./core/validate.js";

import { initDatabase, saveRun, saveResults } from "./db/database.js";
import { getLastRuns, getRunResults } from "./db/queries.js";

type Config = {
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
};

async function loadConfig(path = "config.json"): Promise<Config> {
  const raw = await readFile(path, "utf-8");
  const cleaned = raw.replace(/^\uFEFF/, "").trimStart();
  return JSON.parse(cleaned) as Config;
}

function makeLogFileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `logs/run-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}.log`;
}

function parseArgs(argv: string[]) {
  // argv: ["node", "file", ...]
  const args = argv.slice(2);
  const cmd = args[0] ?? "run";
  const rest = args.slice(1);
  return { cmd, rest };
}

async function cmdHistory(config: Config) {
  const db = initDatabase(config.dbPath);
  const runs = getLastRuns(db, 10);

  console.log("Последние запуски (top 10):");
  for (const r of runs) {
    console.log(
      `#${r.id} | ${r.run_at} | products=${r.total_products} | deficit=${r.deficit_products} | expiring=${r.expiring_products} | unmatched=${r.unmatched_installs}`
    );
  }

  await writeCsv(
    config.runsCsvPath,
    ["id", "run_at", "total_products", "deficit_products", "expiring_products", "unmatched_installs"],
    runs.map((r) => [
      r.id,
      r.run_at,
      r.total_products,
      r.deficit_products,
      r.expiring_products,
      r.unmatched_installs,
    ])
  );

  console.log(`OK: история выгружена -> ${config.runsCsvPath}`);
}

async function cmdRunResults(config: Config, runIdStr: string | undefined) {
  if (!runIdStr) {
    console.log("Надо указать run_id. Пример: npm run dev -- run-results 3");
    return;
  }

  const runId = Number(runIdStr);
  if (!Number.isFinite(runId) || runId <= 0) {
    console.log("run_id должен быть положительным числом.");
    return;
  }

  const db = initDatabase(config.dbPath);
  const rows = getRunResults(db, runId);

  console.log(`Результаты для run_id=${runId} (rows=${rows.length}):`);
  for (const r of rows.slice(0, 30)) {
    console.log(
      `${r.risk} | ${r.product} | demand=${r.demand} | licenses=${r.licenses} | delta=${r.delta} | expires=${r.expires_soon} | end=${r.nearest_end_date ?? ""}`
    );
  }
  if (rows.length > 30) console.log(`... и ещё ${rows.length - 30} строк`);
}

async function cmdRun(config: Config) {
  const logger = await createLogger(makeLogFileName());
  const db = initDatabase(config.dbPath);

  await logger.info("Start license monitoring run");
  await logger.info(`Config: ${JSON.stringify(config)}`);

  // 1) Загружаем CSV
  const installsRaw = await readCsv<InstallationRow>(config.installationsPath);
  const licensesRaw = await readCsv<LicenseRow>(config.licensesPath);

  // 2) Валидация
  const vi = validateInstallations(installsRaw);
  const vl = validateLicenses(licensesRaw);

  if (vi.bad.length || vl.bad.length) {
    const badRows = [...vi.bad, ...vl.bad];
    await writeCsv(
      config.badRowsPath,
      ["source", "reason", "row_json"],
      badRows.map((b) => [b.source, b.reason, b.row_json])
    );
    await logger.warn(`Bad rows saved -> ${config.badRowsPath} (rows=${badRows.length})`);
  }

  // 3) Mapping
  const mappingRows = await readCsv<{ pattern: string; canonical_product: string }>(
    config.mappingPath
  );
  const rules = buildRules(mappingRows);

  // 4) Отчёт
  const { report, unmatched } = buildReport(
    vi.good,
    vl.good,
    rules,
    config.expiresDays
  );

  // 5) CSV
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

  // 6) Excel
  await writeReportXlsx(config.xlsxReportPath, report, unmatched, config.expiresDays);

  // 7) DB: сохраняем run + results
  const runAt = new Date().toISOString();
  const runId = saveRun(db, {
    run_at: runAt,
    total_products: report.length,
    deficit_products: report.filter((r) => r.risk === "DEFICIT").length,
    expiring_products: report.filter((r) => r.expires_soon === "YES").length,
    unmatched_installs: unmatched.length,
  });

  saveResults(db, runId, report);
  await logger.info(`Saved run to DB: run_id=${runId}`);

  await logger.info("Finish license monitoring run");

  console.log(`OK: report -> ${config.reportPath}`);
  console.log(`OK: unmatched -> ${config.unmatchedPath}`);
  console.log(`OK: bad rows (if any) -> ${config.badRowsPath}`);
  console.log(`OK: excel -> ${config.xlsxReportPath}`);
  console.log(`OK: saved to DB -> ${config.dbPath} (run_id=${runId})`);
}

async function main() {
  const config = await loadConfig();
  const { cmd, rest } = parseArgs(process.argv);

  if (cmd === "history") {
    await cmdHistory(config);
    return;
  }

  if (cmd === "run-results") {
    await cmdRunResults(config, rest[0]);
    return;
  }

  // default
  await cmdRun(config);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
