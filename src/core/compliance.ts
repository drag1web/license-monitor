import { resolveProduct, type MappingRule } from "./mapping.js";

export type LicenseType = "per_install" | "per_user" | "concurrent";

export type InstallationRow = {
  device: string;
  software_name: string;
  software_version?: string;
  user?: string;
  detected_at?: string;
};

export type LicenseRow = {
  product_name: string;
  license_type?: string; // из CSV придёт строкой
  count: string;
  end_date?: string;
};

export type ReportRow = {
  product: string;
  product_key: string;

  license_type: LicenseType;
  demand: number;   // сколько "нужно" по правилам (установки/пользователи)
  installs: number; // сколько установок
  users: number;    // сколько уникальных пользователей (если есть)

  licenses: number;
  delta: number; // demand - licenses

  risk: "OK" | "DEFICIT";
  expires_soon: "YES" | "NO";
  nearest_end_date: string | "";
};

export type UnmatchedRow = {
  device: string;
  software_name: string;
  software_version?: string;
  user?: string;
  detected_at?: string;
  reason: string;
};

function parseLicenseType(v: unknown): LicenseType {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "per_user") return "per_user";
  if (s === "concurrent") return "concurrent";
  return "per_install"; // по умолчанию
}

export function buildReport(
  installs: InstallationRow[],
  licenses: LicenseRow[],
  rules: MappingRule[],
  expiresDays: number,
  today = new Date()
): { report: ReportRow[]; unmatched: UnmatchedRow[] } {
  // 1) Установки → canonical + считаем installs + уникальных users
  const installsMap = new Map<
    string,
    { installs: number; usersSet: Set<string>; product: string }
  >();

  const unmatched: UnmatchedRow[] = [];

  for (const i of installs) {
    const r = resolveProduct(i.software_name, rules);

    if (!r.matchedBy) {
      unmatched.push({
        ...i,
        reason: "Не найдено правило сопоставления (mapping.csv)",
      });
    }

    const prev = installsMap.get(r.key);
    const usersSet = prev?.usersSet ?? new Set<string>();

    const u = (i.user ?? "").trim();
    if (u) usersSet.add(u);

    installsMap.set(r.key, {
      installs: (prev?.installs ?? 0) + 1,
      usersSet,
      product: prev?.product ?? r.product,
    });
  }

  // 2) Лицензии → canonical + суммируем count, берём тип, ближайшую дату
  const licenseMap = new Map<
    string,
    { licenses: number; product: string; type: LicenseType; end?: string }
  >();

  for (const l of licenses) {
    const r = resolveProduct(l.product_name, rules);
    const prev = licenseMap.get(r.key);

    const type = parseLicenseType(l.license_type ?? prev?.type ?? "per_install");
    const cnt = Number(l.count ?? 0) || 0;

    const end = pickNearest(prev?.end, l.end_date);

    licenseMap.set(r.key, {
      licenses: (prev?.licenses ?? 0) + cnt,
      product: prev?.product ?? r.product,
      type,
      ...(end ? { end } : {}),
    });
  }

  const keys = new Set<string>([...installsMap.keys(), ...licenseMap.keys()]);
  const report: ReportRow[] = [];

  for (const k of keys) {
    const i = installsMap.get(k);
    const l = licenseMap.get(k);

    const installsN = i?.installs ?? 0;
    const usersN = i?.usersSet.size ?? 0;

    const licenseType: LicenseType = l?.type ?? "per_install";
    const licensesN = l?.licenses ?? 0;

    let demand = installsN;
    if (licenseType === "per_user") demand = usersN;
    if (licenseType === "concurrent") demand = installsN; 

    const delta = demand - licensesN;

    const end = l?.end ?? "";
    const expiresSoon = end ? isSoon(end, expiresDays, today) : false;

    report.push({
      product: l?.product ?? i?.product ?? k,
      product_key: k,

      license_type: licenseType,
      demand,
      installs: installsN,
      users: usersN,

      licenses: licensesN,
      delta,

      risk: delta > 0 ? "DEFICIT" : "OK",
      expires_soon: expiresSoon ? "YES" : "NO",
      nearest_end_date: end,
    });
  }

  // сортировка: дефицит -> истекает -> по delta
  report.sort((a, b) => {
    if (a.risk !== b.risk) return a.risk === "DEFICIT" ? -1 : 1;
    if (a.expires_soon !== b.expires_soon)
      return a.expires_soon === "YES" ? -1 : 1;
    return b.delta - a.delta;
  });

  return { report, unmatched };
}

function pickNearest(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) <= new Date(b) ? a : b;
}

function isSoon(end: string, days: number, today: Date): boolean {
  const diff =
    (new Date(end).getTime() - today.getTime()) /
    (1000 * 60 * 60 * 24);
  return diff <= days;
}
