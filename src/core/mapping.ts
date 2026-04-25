import { normalizeProductName } from "./normalize.js";

export type MappingMatchType = "contains" | "exact" | "regex";

export type MappingRule = {
  pattern: string;
  canonical_product: string;
  canonical_key: string;
  match_type: MappingMatchType;
};

type BuildRuleRow = {
  pattern: string;
  canonical_product: string;
  match_type?: string | null;
};

function normalizeMatchType(value: string | null | undefined): MappingMatchType {
  const v = String(value ?? "contains").trim().toLowerCase();

  if (v === "exact") return "exact";
  if (v === "regex") return "regex";
  return "contains";
}

export function buildRules(rows: BuildRuleRow[]): MappingRule[] {
  return rows
    .map((r) => {
      const canonical = String(r.canonical_product ?? "").trim();
      const rawPattern = String(r.pattern ?? "").trim();
      const matchType = normalizeMatchType(r.match_type);

      return {
        pattern: matchType === "regex" ? rawPattern : normalizeProductName(rawPattern),
        canonical_product: canonical,
        canonical_key: normalizeProductName(canonical),
        match_type: matchType,
      };
    })
    .filter((r) => r.pattern && r.canonical_product)
    .sort((a, b) => {
      const aPriority = a.match_type === "exact" ? 3 : a.match_type === "regex" ? 2 : 1;
      const bPriority = b.match_type === "exact" ? 3 : b.match_type === "regex" ? 2 : 1;

      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.pattern.length - a.pattern.length;
    });
}

function matchesRule(normalizedInput: string, rawInput: string, rule: MappingRule): boolean {
  if (!normalizedInput || !rule.pattern) return false;

  if (rule.match_type === "exact") {
    return normalizedInput === rule.pattern;
  }

  if (rule.match_type === "regex") {
    try {
      return new RegExp(rule.pattern, "i").test(rawInput);
    } catch {
      return false;
    }
  }

  return normalizedInput.includes(rule.pattern);
}

export function resolveProduct(
  rawName: string,
  rules: MappingRule[]
): { product: string; key: string; matchedBy?: string } {
  const normalizedInput = normalizeProductName(rawName);

  for (const rule of rules) {
    if (matchesRule(normalizedInput, rawName, rule)) {
      return {
        product: rule.canonical_product,
        key: rule.canonical_key,
        matchedBy: `${rule.match_type}:${rule.pattern}`,
      };
    }
  }

  return { product: rawName, key: normalizedInput };
}