import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parse } from 'yaml';
import { Anchor } from './schema.js';

export interface Issue {
  file: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  records: Anchor[];
  issues: Issue[];
  files: number;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Finds every `retrieved_at` value anywhere in a parsed record, with its path. */
function collectRetrievedAt(node: unknown, path: string[] = []): { path: string; value: string }[] {
  if (Array.isArray(node))
    return node.flatMap((n, i) => collectRetrievedAt(n, [...path, String(i)]));
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) =>
      k === 'retrieved_at' && typeof v === 'string'
        ? [{ path: [...path, k].join('.'), value: v }]
        : collectRetrievedAt(v, [...path, k]),
    );
  }
  return [];
}

/**
 * Validates `<root>/anchors/*.yaml`. Rules beyond the schema:
 *  - file name must equal `<id>.yaml`
 *  - ids must be unique
 *  - `retrieved_at` must not be in the future (`opts.today` is injectable for tests)
 */
export async function validateRegistry(
  root: string,
  opts: { today?: string } = {},
): Promise<ValidationResult> {
  const now = opts.today ?? today();
  const dir = join(root, 'anchors');
  const issues: Issue[] = [];
  const records: Anchor[] = [];
  const ids = new Map<string, string>();

  let entries: string[];
  try {
    entries = (await readdir(dir)).sort();
  } catch {
    return { records, files: 0, issues: [{ file: dir, path: '', message: 'directory not found' }] };
  }

  let files = 0;
  for (const entry of entries) {
    if (entry === '.gitkeep') continue;
    const file = join(dir, entry);
    if (!entry.endsWith('.yaml')) {
      issues.push({ file, path: '', message: 'only .yaml files are allowed in anchors/' });
      continue;
    }
    files++;

    let raw: unknown;
    try {
      raw = parse(await readFile(file, 'utf8'), { uniqueKeys: true });
    } catch (err) {
      issues.push({
        file,
        path: '',
        message: `invalid YAML: ${(err as Error).message.split('\n')[0]}`,
      });
      continue;
    }

    const parsed = Anchor.safeParse(raw);
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        issues.push({ file, path: i.path.join('.'), message: i.message });
      }
      continue;
    }
    const record = parsed.data;

    if (basename(entry, '.yaml') !== record.id) {
      issues.push({ file, path: 'id', message: `file name must be "${record.id}.yaml"` });
    }
    const previous = ids.get(record.id);
    if (previous) {
      issues.push({ file, path: 'id', message: `duplicate id, already used by ${previous}` });
    }
    ids.set(record.id, file);

    for (const { path, value } of collectRetrievedAt(raw)) {
      if (value > now)
        issues.push({ file, path, message: `retrieved_at ${value} is in the future` });
    }
    records.push(record);
  }

  return { records, issues, files };
}
