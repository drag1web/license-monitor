import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { readFile } from "node:fs/promises";
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
  createMappingRule,
  removeMappingRule,
  listImports,
  type LicenseRegistryInput,
  type MappingRuleInput,
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

async function main() {
  const rawConfig = await loadConfig();
  const config = resolveConfigPaths(rawConfig);
  const db = initDatabase(config.dbPath);

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
      secret: "change-me-super-secret", // лучше вынести в env
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false, // true только под https
      },
    })
  );

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

    try {
      const row = upsertLicenseRegistry(db, {
        id: String(body.id),
        product: String(body.product).trim(),
        vendor: body.vendor ? String(body.vendor) : "",
        license_type: body.license_type,
        seats_total: Number(body.seats_total) || 0,
        seats_used: Number(body.seats_used) || 0,
        starts_at: body.starts_at ? String(body.starts_at) : "",
        expires_at: body.expires_at ? String(body.expires_at) : "",
        note: body.note ? String(body.note) : "",
      });

      res.json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.delete("/api/licenses/:id", requireAuth, requireRole("admin"), (req: Request, res: Response) => {
    const id = String(req.params.id || "").trim();

    if (!id) {
      res.status(400).json({ ok: false, error: "id required" });
      return;
    }

    try {
      const out = removeLicenseRegistry(db, id);
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

      res.json(row);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.delete("/api/mapping-rules/:id", requireAuth, requireRole("admin"), (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "bad id" });
      return;
    }

    try {
      const out = removeMappingRule(db, id);
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
  app.post("/api/run", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
    try {
      const out = await runPipeline(config);
      res.json({ ok: true, runId: out.runId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

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

  const port = 3000;
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
