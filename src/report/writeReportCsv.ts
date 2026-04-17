import { writeFile } from "node:fs/promises";

function escapeCsv(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

export async function writeCsv(
  path: string,
  header: string[],
  rows: (string | number)[][]
): Promise<void> {
  const lines: string[] = [];
  lines.push(header.join(","));

  for (const r of rows) {
    lines.push(r.map((x) => escapeCsv(String(x))).join(","));
  }

  await writeFile(path, lines.join("\n"), "utf-8");
}
