import type { ResultRow } from "../../api";

export type RowKey = string;

export type DiffItem = {
  key: RowKey;
  product: string;
  license_type: string;

  risk_now: string;
  risk_prev: string;

  demand_now: number;
  demand_prev: number;

  licenses_now: number;
  licenses_prev: number;

  delta_now: number;
  delta_prev: number;

  expires_now: boolean;
  expires_prev: boolean;

  kind:
    | "new"          // новая строка
    | "removed"      // исчезла
    | "changed"      // изменилась
    | "same";        // без изменений (обычно не показываем)
};

export type RunDiff = {
  items: DiffItem[];

  counts: {
    totalNow: number;
    totalPrev: number;

    newRows: number;
    removedRows: number;

    worsened: number;   // delta стало хуже
    improved: number;   // delta стало лучше
    expiresNew: number; // стало expires soon (а раньше нет)
  };
};

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toBool(v: unknown) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function s(v: unknown) {
  return String(v ?? "");
}

export function rowKey(r: ResultRow): RowKey {
  const product = s((r as any).product).trim();
  const lt = s((r as any).license_type).trim();
  return `${product}__${lt}`.toLowerCase();
}

export function computeRunDiff(nowRows: ResultRow[], prevRows: ResultRow[]): RunDiff {
  const nowMap = new Map<RowKey, ResultRow>();
  const prevMap = new Map<RowKey, ResultRow>();

  for (const r of nowRows) nowMap.set(rowKey(r), r);
  for (const r of prevRows) prevMap.set(rowKey(r), r);

  const keys = new Set<RowKey>([...nowMap.keys(), ...prevMap.keys()]);

  const items: DiffItem[] = [];
  let newRows = 0;
  let removedRows = 0;
  let worsened = 0;
  let improved = 0;
  let expiresNew = 0;

  for (const key of keys) {
    const now = nowMap.get(key);
    const prev = prevMap.get(key);

    const product = s((now as any)?.product ?? (prev as any)?.product);
    const license_type = s((now as any)?.license_type ?? (prev as any)?.license_type);

    const demand_now = toNum((now as any)?.demand);
    const demand_prev = toNum((prev as any)?.demand);

    const licenses_now = toNum((now as any)?.licenses);
    const licenses_prev = toNum((prev as any)?.licenses);

    const delta_now = toNum((now as any)?.delta);
    const delta_prev = toNum((prev as any)?.delta);

    const expires_now = toBool((now as any)?.expires_soon);
    const expires_prev = toBool((prev as any)?.expires_soon);

    const risk_now = s((now as any)?.risk ?? "");
    const risk_prev = s((prev as any)?.risk ?? "");

    let kind: DiffItem["kind"] = "same";

    if (now && !prev) {
      kind = "new";
      newRows++;
    } else if (!now && prev) {
      kind = "removed";
      removedRows++;
    } else if (now && prev) {
      // changed if any meaningful field differs
      const changed =
        demand_now !== demand_prev ||
        licenses_now !== licenses_prev ||
        delta_now !== delta_prev ||
        expires_now !== expires_prev ||
        risk_now !== risk_prev;

      kind = changed ? "changed" : "same";

      // improvements / worsening based on delta direction
      if (changed) {
        if (delta_now < delta_prev) worsened++;
        if (delta_now > delta_prev) improved++;
        if (expires_now && !expires_prev) expiresNew++;
      }
    }

    items.push({
      key,
      product,
      license_type,
      risk_now,
      risk_prev,
      demand_now,
      demand_prev,
      licenses_now,
      licenses_prev,
      delta_now,
      delta_prev,
      expires_now,
      expires_prev,
      kind,
    });
  }

  return {
    items,
    counts: {
      totalNow: nowRows.length,
      totalPrev: prevRows.length,
      newRows,
      removedRows,
      worsened,
      improved,
      expiresNew,
    },
  };
}

export function diffScore(x: DiffItem) {
  // чем больше score — тем “важнее” показать сверху
  // дефицит/ухудшение сильнее, затем новые expires, затем любые изменения
  const deltaChange = Math.abs(x.delta_now - x.delta_prev);
  const demandChange = Math.abs(x.demand_now - x.demand_prev);
  const licChange = Math.abs(x.licenses_now - x.licenses_prev);

  let score = 0;
  if (x.kind === "new") score += 30;
  if (x.kind === "removed") score += 10;
  if (x.kind === "changed") score += 8;

  // ухудшение delta
  if (x.delta_now < x.delta_prev) score += 25;
  if (x.delta_now > x.delta_prev) score += 12;

  // expires became true
  if (x.expires_now && !x.expires_prev) score += 18;

  score += deltaChange * 2;
  score += demandChange * 1.2;
  score += licChange * 1.0;

  return score;
}
