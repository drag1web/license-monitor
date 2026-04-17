export function normalizeProductName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(r\)|\(tm\)/g, '')
    .replace(/x64|x86/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
