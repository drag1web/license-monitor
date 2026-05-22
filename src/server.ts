import "dotenv/config";
import rateLimit from "express-rate-limit";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import { mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { readCsv } from "./io/readCsv.js";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import session from "express-session";
import bcrypt from "bcrypt";

import {
  initDatabase,
  listLicensesRegistry,
  upsertLicenseRegistry,
  removeLicenseRegistry,
  listProducts,
  listMappingRules,
  createProduct,
  updateProduct,
  removeProduct,
  createMappingRule,
  updateMappingRule,
  removeMappingRule,
  testMappingRules,
  listImports,
  listAlerts,
  getUnreadAlertsCount,
  markAlertRead,
  markAllAlertsRead,
  createAlert,
  createImportLog,
  deleteAlert,
  deleteReadAlerts,
  deleteOldImportsKeepLast,
  listClientLicenses,
  createClientLicense,
  updateClientLicense,
  activateLicense,
  checkLicense,
  deactivateLicense,
  listLicenseActivations,
  listLicenseEvents,
  getRunUnmatchedRows,
  upsertMappingRule,
  cleanupOldReadAlerts,
  createAdminAuditLog,
  listAdminAuditLog,
  type LicenseRegistryInput,
  type MappingRuleInput,
  type ClientLicenseInput,
} from "./db/database.js";

import { migrateLicensesJsonToRegistry } from "./db/migrateLicensesRegistry.js";

import {
  getLastRuns,
  getRunResults,
  deleteRun,
  deleteRuns,
  deleteRunsKeepLast,
  deleteRunsOlderThanDays,
  deleteAllRuns,
} from "./db/queries.js";

import { runPipeline, type Config } from "./app/runPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type AuthedReq = Request & {
  session: session.Session & {
    user?: { id: number; login: string; role: "admin" | "viewer" };
  };
};

async function loadConfig(): Promise<Config> {
  const configPath = path.resolve(process.cwd(), "config.json");
  const raw = await readFile(configPath, "utf-8");
  const cleaned = raw.replace(/^\uFEFF/, "").trimStart();
  return JSON.parse(cleaned) as Config;
}

function resolveConfigPaths(config: Config): Config {
  const root = process.cwd();

  return {
    ...config,
    installationsPath: path.resolve(root, config.installationsPath),
    licensesPath: path.resolve(root, config.licensesPath),
    mappingPath: path.resolve(root, config.mappingPath),
    reportPath: path.resolve(root, config.reportPath),
    unmatchedPath: path.resolve(root, config.unmatchedPath),
    badRowsPath: path.resolve(root, config.badRowsPath),
    xlsxReportPath: path.resolve(root, config.xlsxReportPath),
    dbPath: path.resolve(root, config.dbPath),
    runsCsvPath: path.resolve(root, config.runsCsvPath),
    ...(config.legacyLicensesJsonPath
      ? {
        legacyLicensesJsonPath: path.resolve(root, config.legacyLicensesJsonPath),
      }
      : {}),
  };
}

function safeBackupStamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
}

function download(res: Response, filePath: string) {
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "Файл не найден", filePath });
    return;
  }
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${path.basename(filePath)}"`
  );
  createReadStream(filePath).pipe(res);
}

function getRequestIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim();
  }

  return req.socket.remoteAddress;
}

function requireAuth(req: AuthedReq, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  next();
}

function requireRole(role: "admin" | "viewer") {
  return (req: AuthedReq, res: Response, next: NextFunction) => {
    if (!req.session?.user) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    if (req.session.user.role !== role) {
      res.status(403).json({ ok: false, error: "forbidden" });
      return;
    }

    next();
  };
}


type LicenseCsvRow = {
  id?: string;
  product?: string;
  product_name?: string;
  vendor?: string;
  license_type?: string;
  assignment_type?: string;
  seats_total?: string | number;
  seats_used?: string | number;
  count?: string | number;
  starts_at?: string;
  expires_at?: string;
  start_date?: string;
  end_date?: string;
  note?: string;
};

type MappingCsvRow = {
  pattern?: string;
  canonical_product?: string;
  product?: string;
  product_name?: string;
  match_type?: string;
};

function makeRegistryId(row: LicenseCsvRow, index: number) {
  return (
    row.id?.trim() ||
    `CSV-${String(row.product || row.product_name || "LICENSE").trim().toUpperCase().replace(/\s+/g, "-")}-${index + 1}`
  );
}

async function importLicensesCsvToRegistry(db: ReturnType<typeof initDatabase>, filePath: string) {
  const rows = await readCsv<LicenseCsvRow>(filePath);

  let imported = 0;
  let skipped = 0;

  const tx = db.transaction((inputRows: LicenseCsvRow[]) => {
    inputRows.forEach((row, index) => {
      const product = String(row.product || row.product_name || "").trim();

      if (!product) {
        skipped += 1;
        return;
      }

      upsertLicenseRegistry(db, {
        id: makeRegistryId(row, index),
        product,
        vendor: String(row.vendor || "").trim(),
        license_type: ["perpetual", "subscription", "trial"].includes(String(row.license_type))
          ? row.license_type as LicenseRegistryInput["license_type"]
          : "perpetual",
        assignment_type: ["per_install", "per_user", "concurrent"].includes(String(row.assignment_type))
          ? row.assignment_type as LicenseRegistryInput["assignment_type"]
          : "per_install",
        seats_total: Number(row.seats_total ?? row.count ?? 0) || 0,
        seats_used: Number(row.seats_used ?? 0) || 0,
        starts_at: String(row.starts_at || row.start_date || "").trim(),
        expires_at: String(row.expires_at || row.end_date || "").trim(),
        note: String(row.note || "Импортировано из CSV").trim(),
      });

      imported += 1;
    });
  });

  tx(rows);

  return { rowsCount: rows.length, imported, skipped };
}

async function importMappingCsvToDb(db: ReturnType<typeof initDatabase>, filePath: string) {
  const rows = await readCsv<MappingCsvRow>(filePath);

  let imported = 0;
  let skipped = 0;

  const tx = db.transaction((inputRows: MappingCsvRow[]) => {
    inputRows.forEach((row) => {
      const pattern = String(row.pattern || "").trim();
      const canonical = String(row.canonical_product || row.product || row.product_name || "").trim();

      if (!pattern || !canonical) {
        skipped += 1;
        return;
      }

      upsertMappingRule(db, {
        pattern,
        canonical_product: canonical,
        match_type: String(row.match_type || "contains").trim(),
      });

      imported += 1;
    });
  });

  tx(rows);

  return { rowsCount: rows.length, imported, skipped };
}

async function main() {
  const rawConfig = await loadConfig();
  const config = resolveConfigPaths(rawConfig);
  const db = initDatabase(config.dbPath);

  function audit(
    req: AuthedReq,
    action: string,
    entityType: string,
    entityId?: string | number | null,
    message?: string
  ) {
    try {
      createAdminAuditLog(db, {
        user_id: req.session.user?.id ?? null,
        login: req.session.user?.login ?? null,
        action,
        entity_type: entityType,
        entity_id: entityId ?? null,
        message: message ?? null,
      });
    } catch (e) {
      console.error("AUDIT LOG ERROR:", e);
    }
  }

  if (config.legacyLicensesJsonPath) {
    try {
      const result = await migrateLicensesJsonToRegistry(db, config.legacyLicensesJsonPath);

      if (result.migrated > 0 || result.skipped > 0) {
        console.log("LICENSES MIGRATION:");
        console.log(`  migrated: ${result.migrated}`);
        console.log(`  skipped: ${result.skipped}`);
        if (result.backupPath) {
          console.log(`  backup:   ${result.backupPath}`);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("LICENSES MIGRATION ERROR:", msg);
    }
  }

  const app = express();

  const dataDir = path.resolve(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, dataDir);
      },
      filename: (req, file, cb) => {
        const importType = String(req.body?.import_type ?? "").trim();

        const safeName =
          importType === "installations"
            ? "installations.csv"
            : importType === "licenses"
              ? "licenses.csv"
              : importType === "mapping"
                ? "mapping.csv"
                : file.originalname || "upload.csv";

        cb(null, safeName);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const name = String(file.originalname || "").toLowerCase();
      if (!name.endsWith(".csv")) {
        cb(new Error("only .csv files are allowed"));
        return;
      }
      cb(null, true);
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
    },
  });

  // Если в Electron/локально — cors не обязателен. Но пусть будет, чтобы не ломать.
  app.use(cors());
  app.use(express.json());

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  // ---------------- sessions ----------------
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "dev-only-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // true только под https
      },
    })
  );

  const authLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const licenseLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/auth/login", authLimiter);
  app.use("/api/license", licenseLimiter);

  // ---------------- AUTH ----------------
  app.get("/api/auth/me", (req: AuthedReq, res: Response) => {
    res.json({ ok: true, user: req.session?.user ?? null });
  });

  app.post("/api/auth/login", (req: AuthedReq, res: Response) => {
    const { login, password } = req.body ?? {};
    if (!login || !password) {
      res.status(400).json({ ok: false, error: "login/password required" });
      return;
    }

    const row = db
      .prepare("SELECT id, login, password_hash, role FROM users WHERE login=?")
      .get(login) as
      | { id: number; login: string; password_hash: string; role: "admin" | "viewer" }
      | undefined;

    if (!row) {
      res.status(401).json({ ok: false, error: "bad credentials" });
      return;
    }

    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) {
      res.status(401).json({ ok: false, error: "bad credentials" });
      return;
    }

    req.session.user = { id: row.id, login: row.login, role: row.role };
    res.json({ ok: true, user: req.session.user });
  });

  app.post("/api/auth/register", (req: AuthedReq, res: Response) => {
    const { login, password } = req.body ?? {};

    if (!login || !password) {
      res.status(400).json({ ok: false, error: "login/password required" });
      return;
    }

    const cleanLogin = String(login).trim();

    if (cleanLogin.length < 3) {
      res.status(400).json({ ok: false, error: "login must be at least 3 chars" });
      return;
    }

    if (String(password).length < 4) {
      res.status(400).json({ ok: false, error: "password must be at least 4 chars" });
      return;
    }

    const existing = db
      .prepare("SELECT id FROM users WHERE login = ?")
      .get(cleanLogin) as { id: number } | undefined;

    if (existing) {
      res.status(409).json({ ok: false, error: "user already exists" });
      return;
    }

    try {
      const result = db
        .prepare("INSERT INTO users(login, password_hash, role, created_at) VALUES (?, ?, ?, ?)")
        .run(
          cleanLogin,
          bcrypt.hashSync(String(password), 10),
          "viewer",
          new Date().toISOString()
        );

      const user = {
        id: Number(result.lastInsertRowid),
        login: cleanLogin,
        role: "viewer" as const,
      };

      req.session.user = user;

      res.json({ ok: true, user });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/auth/change-password", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const { currentPassword, newPassword } = req.body ?? {};

    if (!currentPassword || !newPassword) {
      res.status(400).json({ ok: false, error: "currentPassword/newPassword required" });
      return;
    }

    if (String(newPassword).length < 4) {
      res.status(400).json({ ok: false, error: "new password must be at least 4 chars" });
      return;
    }

    const userLogin = req.session.user?.login;
    if (!userLogin) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const row = db
      .prepare("SELECT id, login, password_hash FROM users WHERE login = ?")
      .get(userLogin) as { id: number; login: string; password_hash: string } | undefined;

    if (!row) {
      res.status(404).json({ ok: false, error: "user not found" });
      return;
    }

    const ok = bcrypt.compareSync(String(currentPassword), row.password_hash);
    if (!ok) {
      res.status(401).json({ ok: false, error: "current password is incorrect" });
      return;
    }

    try {
      const nextHash = bcrypt.hashSync(String(newPassword), 10);

      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(nextHash, row.id);

      res.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/auth/logout", (req: AuthedReq, res: Response) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/licenses", requireAuth, (_req: Request, res: Response) => {
    try {
      const rows = listLicensesRegistry(db);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/licenses/upsert", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const body = req.body as Partial<LicenseRegistryInput>;

    if (!body?.id) {
      res.status(400).json({ ok: false, error: "id required" });
      return;
    }

    if (!body?.product?.trim()) {
      res.status(400).json({ ok: false, error: "product required" });
      return;
    }

    if (!body?.license_type) {
      res.status(400).json({ ok: false, error: "license_type required" });
      return;
    }

    if (!body?.assignment_type) {
      res.status(400).json({ ok: false, error: "assignment_type required" });
      return;
    }

    try {
      const before = listLicensesRegistry(db).find((x) => x.id === String(body.id));
      const row = upsertLicenseRegistry(db, {
        id: String(body.id),
        product: String(body.product).trim(),
        vendor: body.vendor ? String(body.vendor) : "",
        license_type: body.license_type,
        assignment_type: body.assignment_type,
        seats_total: Number(body.seats_total) || 0,
        seats_used: Number(body.seats_used) || 0,
        starts_at: body.starts_at ? String(body.starts_at) : "",
        expires_at: body.expires_at ? String(body.expires_at) : "",
        note: body.note ? String(body.note) : "",
      });

      audit(
        req,
        before ? "update_license_registry" : "create_license_registry",
        "licenses_registry",
        row.id,
        before
          ? `Изменена лицензия "${row.product}": seats ${before.seats_used}/${before.seats_total} → ${row.seats_used}/${row.seats_total}`
          : `Создана лицензия "${row.product}": seats ${row.seats_used}/${row.seats_total}`
      );

      res.json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.delete("/api/licenses/:id", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const id = String(req.params.id || "").trim();

    if (!id) {
      res.status(400).json({ ok: false, error: "id required" });
      return;
    }

    try {
      const before = listLicensesRegistry(db).find((x) => x.id === id);
      const out = removeLicenseRegistry(db, id);
      audit(
        req,
        "delete_license_registry",
        "licenses_registry",
        id,
        before
          ? `Удалена лицензия "${before.product}": seats ${before.seats_used}/${before.seats_total}`
          : `Удалена лицензия id=${id}`
      );
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.get("/api/products", requireAuth, (_req: Request, res: Response) => {
    try {
      const rows = listProducts(db);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/products", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const body = req.body as Partial<{ name: string; vendor?: string; category?: string }>;

    if (!body?.name?.trim()) {
      res.status(400).json({ ok: false, error: "name required" });
      return;
    }

    try {
      const row = createProduct(db, {
        name: String(body.name).trim(),
        vendor: body.vendor ? String(body.vendor) : undefined,
        category: body.category ? String(body.category) : undefined,
      });

      audit(
        req,
        "create_product",
        "products",
        row.id,
        `Создан продукт "${row.name}"`
      );

      res.json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.put("/api/products/:id", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const id = Number(req.params.id);
    const body = req.body as Partial<{ name: string; vendor?: string; category?: string }>;

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad id" });
      return;
    }

    if (!body?.name?.trim()) {
      res.status(400).json({ ok: false, error: "name required" });
      return;
    }

    try {
      const before = listProducts(db).find((x) => x.id === id);
      const row = updateProduct(db, id, {
        name: String(body.name).trim(),
        vendor: body.vendor ? String(body.vendor) : undefined,
        category: body.category ? String(body.category) : undefined,
      });

      audit(
        req,
        "update_product",
        "products",
        row.id,
        before
          ? `Изменён продукт "${before.name}" → "${row.name}"`
          : `Изменён продукт "${row.name}"`
      );

      res.json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.delete("/api/products/:id", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad id" });
      return;
    }

    try {
      const before = listProducts(db).find((x) => x.id === id);
      const out = removeProduct(db, id);
      audit(
        req,
        "delete_product",
        "products",
        id,
        before ? `Удалён продукт "${before.name}"` : `Удалён продукт id=${id}`
      );
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.get("/api/mapping-rules", requireAuth, (_req: Request, res: Response) => {
    try {
      const rows = listMappingRules(db);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/mapping-rules", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const body = req.body as Partial<MappingRuleInput>;

    if (!body?.pattern?.trim()) {
      res.status(400).json({ ok: false, error: "pattern required" });
      return;
    }

    if (!body?.canonical_product?.trim()) {
      res.status(400).json({ ok: false, error: "canonical_product required" });
      return;
    }

    try {
      const row = createMappingRule(db, {
        pattern: String(body.pattern).trim(),
        canonical_product: String(body.canonical_product).trim(),
        product_id: Number.isFinite(Number(body.product_id)) ? Number(body.product_id) : undefined,
        match_type: body.match_type ? String(body.match_type) : "contains",
      });

      audit(
        req,
        "create_mapping_rule",
        "mapping_rules",
        row.id,
        `Создано правило "${row.pattern}" → "${row.canonical_product}"`
      );

      res.json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/mapping-rules/test", requireAuth, (req: AuthedReq, res: Response) => {
    const input = String(req.body?.input ?? "").trim();

    if (!input) {
      res.status(400).json({ ok: false, error: "input required" });
      return;
    }

    try {
      const result = testMappingRules(db, input);
      res.json({ ok: true, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.put("/api/mapping-rules/:id", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const id = Number(req.params.id);
    const body = req.body as Partial<MappingRuleInput>;

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad id" });
      return;
    }

    if (!body?.pattern?.trim()) {
      res.status(400).json({ ok: false, error: "pattern required" });
      return;
    }

    if (!body?.canonical_product?.trim()) {
      res.status(400).json({ ok: false, error: "canonical_product required" });
      return;
    }

    try {
      const before = listMappingRules(db).find((x) => x.id === id);
      const row = updateMappingRule(db, id, {
        pattern: String(body.pattern).trim(),
        canonical_product: String(body.canonical_product).trim(),
        product_id: Number.isFinite(Number(body.product_id)) ? Number(body.product_id) : undefined,
        match_type: body.match_type ? String(body.match_type) : "contains",
      });

      audit(
        req,
        "update_mapping_rule",
        "mapping_rules",
        row.id,
        before
          ? `Изменено правило "${before.pattern}" → "${row.pattern}", продукт: "${row.canonical_product}"`
          : `Изменено правило "${row.pattern}"`
      );

      res.json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.delete("/api/mapping-rules/:id", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad id" });
      return;
    }

    try {
      const before = listMappingRules(db).find((x) => x.id === id);
      const out = removeMappingRule(db, id);
      audit(
        req,
        "delete_mapping_rule",
        "mapping_rules",
        id,
        before
          ? `Удалено правило "${before.pattern}" → "${before.canonical_product}"`
          : `Удалено правило id=${id}`
      );
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.get("/api/imports", requireAuth, (_req: Request, res: Response) => {
    try {
      const rows = listImports(db);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post(
    "/api/imports/upload",
    requireAuth,
    requireRole("admin"),
    upload.single("file"),
    async (req: AuthedReq, res: Response) => {
      try {
        const importType = String(req.body?.import_type ?? "").trim();
        const file = req.file;

        if (!importType || !["installations", "licenses", "mapping"].includes(importType)) {
          res.status(400).json({ ok: false, error: "bad import_type" });
          return;
        }

        if (!file) {
          res.status(400).json({ ok: false, error: "file required" });
          return;
        }

        if (importType === "licenses") {
          const result = await importLicensesCsvToRegistry(db, file.path);

          createImportLog(db, {
            import_type: importType,
            file_name: file.originalname,
            source_path: "sqlite:licenses_registry",
            rows_count: result.imported,
            status: result.skipped > 0 ? "partial" : "success",
            comment: `imported to licenses_registry: ${result.imported}, skipped: ${result.skipped}`,
          });

          audit(
            req,
            "import_csv",
            "licenses_registry",
            null,
            `Импорт лицензий из ${file.originalname}: imported=${result.imported}, skipped=${result.skipped}`
          );

          res.json({
            ok: true,
            file_name: file.originalname,
            saved_as: file.filename,
            path: file.path,
            imported: result.imported,
            skipped: result.skipped,
          });
          return;
        }

        if (importType === "mapping") {
          const result = await importMappingCsvToDb(db, file.path);

          createImportLog(db, {
            import_type: importType,
            file_name: file.originalname,
            source_path: "sqlite:mapping_rules",
            rows_count: result.imported,
            status: result.skipped > 0 ? "partial" : "success",
            comment: `imported to mapping_rules: ${result.imported}, skipped: ${result.skipped}`,
          });

          audit(
            req,
            "import_csv",
            "mapping_rules",
            null,
            `Импорт правил из ${file.originalname}: imported=${result.imported}, skipped=${result.skipped}`
          );

          res.json({
            ok: true,
            file_name: file.originalname,
            saved_as: file.filename,
            path: file.path,
            imported: result.imported,
            skipped: result.skipped,
          });
          return;
        }

        createImportLog(db, {
          import_type: importType,
          file_name: file.originalname,
          source_path: file.path,
          rows_count: 0,
          status: "success",
          comment: `uploaded installations.csv by ${req.session.user?.login ?? "unknown"}`,
        });

        audit(
          req,
          "import_csv",
          "installations",
          file.filename,
          `Загружен файл установок ${file.originalname}`
        );

        res.json({
          ok: true,
          file_name: file.originalname,
          saved_as: file.filename,
          path: file.path,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ ok: false, error: msg });
      }
    }
  );

  app.post("/api/imports/cleanup/keep-last", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const keepLast = Number(req.body?.keepLast);

    if (!Number.isFinite(keepLast) || keepLast < 0) {
      res.status(400).json({ ok: false, error: "keepLast must be >= 0" });
      return;
    }

    try {
      const out = deleteOldImportsKeepLast(db, keepLast);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.get("/api/admin-audit-log", requireAuth, requireRole("admin"), (req: Request, res: Response) => {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;

    try {
      const rows = listAdminAuditLog(db, limit);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.get("/api/alerts", requireAuth, (req: Request, res: Response) => {
    const limitRaw = Number(req.query.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, 100)
        : 20;

    try {
      const items = listAlerts(db, limit);
      const unread = getUnreadAlertsCount(db);
      res.json({ items, unread });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/alerts/:id/read", requireAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad alert id" });
      return;
    }

    try {
      const out = markAlertRead(db, id);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/alerts/read-all", requireAuth, (_req: Request, res: Response) => {
    try {
      const out = markAllAlertsRead(db);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.delete("/api/alerts/read", requireAuth, (_req: Request, res: Response) => {
    try {
      const out = deleteReadAlerts(db);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.delete("/api/alerts/:id", requireAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad alert id" });
      return;
    }

    try {
      const out = deleteAlert(db, id);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/alerts/cleanup/older-than", requireAuth, (req, res) => {
    try {
      const { days } = req.body;

      if (!days || typeof days !== "number") {
        return res.status(400).json({ error: "days is required" });
      }

      const out = cleanupOldReadAlerts(db, days);
      res.json(out);
    } catch (err) {
      console.error("Cleanup alerts error:", err);
      res.status(500).json({ error: "Failed to cleanup alerts" });
    }
  });

  // ---------------- SERVER-SIDE LICENSING ----------------

  app.get("/api/client-licenses", requireAuth, (_req: Request, res: Response) => {
    try {
      const rows = listClientLicenses(db);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/client-licenses", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const body = req.body as Partial<ClientLicenseInput>;

    if (!body?.license_key?.trim()) {
      res.status(400).json({ ok: false, error: "license_key required" });
      return;
    }

    if (!body?.product_name?.trim()) {
      res.status(400).json({ ok: false, error: "product_name required" });
      return;
    }

    if (!body?.customer_name?.trim()) {
      res.status(400).json({ ok: false, error: "customer_name required" });
      return;
    }

    try {
      const row = createClientLicense(db, {
        license_key: String(body.license_key).trim(),
        product_id: Number.isFinite(Number(body.product_id)) ? Number(body.product_id) : undefined,
        product_name: String(body.product_name).trim(),
        customer_name: String(body.customer_name).trim(),
        status: body.status ?? "active",
        expires_at: body.expires_at ? String(body.expires_at) : undefined,
        max_activations: Number(body.max_activations) || 1,
      });
      audit(
        req,
        "create_client_license",
        "client_licenses",
        row.id,
        `Создан клиентский ключ для "${row.product_name}", клиент: "${row.customer_name}", лимит: ${row.max_activations}`
      );

      res.json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.put("/api/client-licenses/:id", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const id = Number(req.params.id);
    const body = req.body as Partial<ClientLicenseInput>;

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad id" });
      return;
    }

    try {
      const before = listClientLicenses(db).find((x) => x.id === id);
      const row = updateClientLicense(db, id, {
        ...(body.license_key !== undefined
          ? { license_key: String(body.license_key).trim() }
          : {}),

        ...(body.product_id !== undefined && Number.isFinite(Number(body.product_id))
          ? { product_id: Number(body.product_id) }
          : {}),

        ...(body.product_name !== undefined
          ? { product_name: String(body.product_name).trim() }
          : {}),

        ...(body.customer_name !== undefined
          ? { customer_name: String(body.customer_name).trim() }
          : {}),

        ...(body.status !== undefined
          ? { status: body.status }
          : {}),

        ...(body.expires_at !== undefined
          ? { expires_at: String(body.expires_at) }
          : {}),

        ...(body.max_activations !== undefined
          ? { max_activations: Number(body.max_activations) || 1 }
          : {}),
      });

      audit(
        req,
        row.status === "blocked" && before?.status !== "blocked"
          ? "block_client_license"
          : "update_client_license",
        "client_licenses",
        row.id,
        before
          ? `Изменён клиентский ключ "${row.product_name}", статус: ${before.status} → ${row.status}, лимит: ${before.max_activations} → ${row.max_activations}`
          : `Изменён клиентский ключ "${row.product_name}"`
      );

      res.json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      if (msg === "client license not found") {
        res.status(404).json({ ok: false, error: msg });
        return;
      }

      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.get("/api/client-licenses/:id/activations", requireAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad id" });
      return;
    }

    try {
      const rows = listLicenseActivations(db, id);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.get("/api/client-licenses/:id/events", requireAuth, (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad id" });
      return;
    }

    try {
      const rows = listLicenseEvents(db, id);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });


  app.get("/api/license-events", requireAuth, (_req: Request, res: Response) => {
    try {
      const rows = listLicenseEvents(db);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // Public API for client applications.
  // Здесь специально нет requireAuth: это endpoint для внешнего клиентского приложения.
  app.post("/api/license/activate", (req: Request, res: Response) => {
    try {
      const result = activateLicense(db, {
        license_key: String(req.body?.license_key ?? ""),
        device_id: String(req.body?.device_id ?? ""),
        device_name: req.body?.device_name ? String(req.body.device_name) : undefined,
        ip_address: getRequestIp(req),
      });

      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/license/check", (req: Request, res: Response) => {
    try {
      const result = checkLicense(db, {
        license_key: String(req.body?.license_key ?? ""),
        device_id: String(req.body?.device_id ?? ""),
        ip_address: getRequestIp(req),
      });

      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/api/license/deactivate", (req: Request, res: Response) => {
    try {
      const result = deactivateLicense(db, {
        license_key: String(req.body?.license_key ?? ""),
        device_id: String(req.body?.device_id ?? ""),
        ip_address: getRequestIp(req),
      });

      res.json(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });


  // ---------------- API ----------------
  app.get("/api/health", (_req: Request, res: Response) => res.json({ ok: true }));


  // историю/результаты можно тоже защитить, но обычно дают читать всем авторизованным.
  // Я защищаю всё, кроме health.
  app.get("/api/runs", requireAuth, (_req: Request, res: Response) => {
    const runs = getLastRuns(db, 50);
    res.json(runs);
  });

  app.get("/api/runs/:id", requireAuth, (req: Request, res: Response) => {
    const runId = Number(req.params.id);
    if (!Number.isFinite(runId) || runId <= 0) {
      res.status(400).json({ error: "bad run id" });
      return;
    }
    res.json(getRunResults(db, runId));
  });

  app.get("/api/runs/:id/unmatched", requireAuth, (req: Request, res: Response) => {
    const runId = Number(req.params.id);

    if (!Number.isFinite(runId) || runId <= 0) {
      res.status(400).json({ ok: false, error: "bad run id" });
      return;
    }

    try {
      const rows = getRunUnmatchedRows(db, runId);
      res.json(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.delete("/api/runs/:id", requireAuth, requireRole("admin"), (req: Request, res: Response) => {
    const runId = Number(req.params.id);
    if (!Number.isFinite(runId) || runId <= 0) {
      res.status(400).json({ ok: false, error: "bad run id" });
      return;
    }

    try {
      deleteRun(db, runId);
      res.json({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      if (msg === "run not found") {
        res.status(404).json({ ok: false, error: msg });
        return;
      }

      res.status(500).json({ ok: false, error: msg });
    }
  });

  // bulk delete by ids
  app.post("/api/runs/bulk-delete", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const idsRaw = req.body?.ids;

    if (!Array.isArray(idsRaw)) {
      res.status(400).json({ ok: false, error: "ids[] required" });
      return;
    }

    const ids = idsRaw.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);

    try {
      const out = deleteRuns(db, ids);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // cleanup: keep last N
  app.post("/api/runs/cleanup/keep-last", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const keepLast = Number(req.body?.keepLast);

    if (!Number.isFinite(keepLast) || keepLast < 0) {
      res.status(400).json({ ok: false, error: "keepLast must be >= 0" });
      return;
    }

    // защита от случайного wipe
    if (keepLast === 0 && req.body?.confirm !== "DELETE_ALL") {
      res.status(400).json({
        ok: false,
        error: 'To delete all runs set confirm="DELETE_ALL"',
      });
      return;
    }

    try {
      const out = deleteRunsKeepLast(db, keepLast);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // cleanup: older than N days
  app.post("/api/runs/cleanup/older-than", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    const days = Number(req.body?.days);

    if (!Number.isFinite(days) || days < 0) {
      res.status(400).json({ ok: false, error: "days must be >= 0" });
      return;
    }

    try {
      const out = deleteRunsOlderThanDays(db, days);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // optional explicit delete all (если хочешь отдельной кнопкой)
  app.post("/api/runs/cleanup/delete-all", requireAuth, requireRole("admin"), (req: AuthedReq, res: Response) => {
    if (req.body?.confirm !== "DELETE_ALL") {
      res.status(400).json({ ok: false, error: 'Set confirm="DELETE_ALL"' });
      return;
    }

    try {
      const out = deleteAllRuns(db);
      res.json(out);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  // запуск проверки — строго только после логина
  app.post("/api/run", requireAuth, requireRole("admin"), async (req: AuthedReq, res: Response) => {
    try {
      const out = await runPipeline(config);
      audit(req, "run_check", "run", out.runId, `Запущена проверка лицензий #${out.runId}`);
      res.json({ ok: true, runId: out.runId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);

      try {
        createAlert(db, {
          type: "pipeline_error",
          severity: "critical",
          title: "Ошибка выполнения проверки",
          message: msg,
        });
      } catch (alertErr) {
        console.error("ALERT CREATE ERROR:", alertErr);
      }

      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.get(
    "/api/admin/backup/database",
    requireAuth,
    requireRole("admin"),
    (req: AuthedReq, res: Response) => {
      try {
        const backupDir = path.resolve(process.cwd(), "backups");
        mkdirSync(backupDir, { recursive: true });

        const fileName = `license-monitor-db-${safeBackupStamp()}.sqlite`;
        const backupPath = path.join(backupDir, fileName);

        if (existsSync(backupPath)) {
          rmSync(backupPath, { force: true });
        }

        // Важно: VACUUM INTO создаёт консистентную копию SQLite,
        // а не просто копирует .sqlite файл рядом с WAL.
        db.prepare("VACUUM INTO ?").run(backupPath);

        audit(
          req,
          "backup_database",
          "database",
          fileName,
          `Создана резервная копия базы данных: ${fileName}`
        );

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`
        );

        const stream = createReadStream(backupPath);

        stream.on("close", () => {
          try {
            rmSync(backupPath, { force: true });
          } catch {
            // ignore cleanup error
          }
        });

        stream.pipe(res);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(500).json({ ok: false, error: msg });
      }
    }
  );

  // ---------------- downloads (тоже под auth) ----------------
  app.get("/download/report.xlsx", requireAuth, (_req: Request, res: Response) =>
    download(res, config.xlsxReportPath)
  );
  app.get("/download/report.csv", requireAuth, (_req: Request, res: Response) =>
    download(res, config.reportPath)
  );
  app.get("/download/runs.csv", requireAuth, (_req: Request, res: Response) =>
    download(res, config.runsCsvPath)
  );
  app.get("/download/unmatched.csv", requireAuth, (_req: Request, res: Response) =>
    download(res, config.unmatchedPath)
  );
  app.get("/download/bad_rows.csv", requireAuth, (_req: Request, res: Response) =>
    download(res, config.badRowsPath)
  );

  // ---------------- FRONT (Vite внутри Express) ----------------

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => {
    console.log(`OK: сервер поднят -> http://localhost:${port}`);
    console.log("AUTH:");
    console.log("  GET  /api/auth/me");
    console.log("  POST /api/auth/login {login,password}");
    console.log("  POST /api/auth/logout");
    console.log("API:");
    console.log("  GET  /api/health");
    console.log("  GET  /api/runs (auth)");
    console.log("  GET  /api/runs/:id (auth)");
    console.log("  POST /api/run (auth)");
    console.log("DOWNLOADS (auth): /download/*");
    console.log("  POST /api/auth/change-password {currentPassword,newPassword}");
  });
}

main().catch((e) => {
  console.error("SERVER ERROR:", e);
  process.exit(1);
});
