import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

export async function readCsv<T extends Record<string, any>>(path: string): Promise<T[]> {
  const text = await readFile(path, 'utf-8');
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}
