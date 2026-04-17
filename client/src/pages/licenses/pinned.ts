const PINNED_KEY = "lm_pinned_licenses_v1";

export function loadPinned(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}

export function savePinned(s: Set<string>) {
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(s)));
  } catch {
    // ignore
  }
}
