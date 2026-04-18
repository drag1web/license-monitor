const fs = require("node:fs/promises");
const path = require("node:path");

function nowISO() {
  return new Date().toISOString();
}

function createLicensesRepo(dataDir) {
  const file = path.join(dataDir, "licenses.json");

  async function readAll() {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function writeAll(rows) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf8");
  }

  return {
    async list() {
      const rows = selectAllStmt.all();
      console.log("LICENSES FROM DB:", rows);
      return rows;
      return await readAll();
    },

    async upsert(input) {
      const rows = await readAll();
      const next = { ...input, updated_at: nowISO() };

      const idx = rows.findIndex((r) => r.id === input.id);
      if (idx >= 0) rows[idx] = next;
      else rows.unshift(next);

      await writeAll(rows);
      return next;
    },

    async remove(id) {
      const rows = await readAll();
      const next = rows.filter((r) => r.id !== id);
      await writeAll(next);
      return { ok: true };
    },
  };
}

module.exports = { createLicensesRepo };
