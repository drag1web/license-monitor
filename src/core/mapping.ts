import { normalizeProductName } from "./normalize.js";

export type MappingRule = {
  pattern: string;           // нормализованный pattern
  canonical_product: string; // красивое canonical
  canonical_key: string;     // нормализованный ключ canonical
};

export function buildRules(rows: { pattern: string; canonical_product: string }[]): MappingRule[] {
  return rows
    .map((r) => {
      const canonical = r.canonical_product.trim();
      return {
        pattern: normalizeProductName(r.pattern),
        canonical_product: canonical,
        canonical_key: normalizeProductName(canonical),
      };
    })
    // важный момент: более длинные pattern должны применяться раньше
    .sort((a, b) => b.pattern.length - a.pattern.length);
}

export function resolveProduct(
  rawName: string,
  rules: MappingRule[]
): { product: string; key: string; matchedBy?: string } {
  const n = normalizeProductName(rawName);

  for (const rule of rules) {
    if (n.includes(rule.pattern)) {
      return {
        product: rule.canonical_product,
        key: rule.canonical_key,
        matchedBy: rule.pattern,
      };
    }
  }

  // если правило не нашлось — возвращаем само имя после нормализации как ключ,
  // а “красивое” имя оставляем как было
  return { product: rawName, key: n };
}
