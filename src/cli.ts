import { readFile, writeFile } from 'node:fs/promises';
import { anchorJsonSchema } from './json-schema.js';
import { validateRegistry } from './validate.js';

const SCHEMA_FILE = 'schema/anchor.schema.json';

async function validate(root: string): Promise<number> {
  const { records, issues, files } = await validateRegistry(root);
  if (issues.length > 0) {
    console.error(
      `Registry validation failed (${issues.length} problem${issues.length > 1 ? 's' : ''}):\n`,
    );
    for (const i of issues)
      console.error(`  ${i.file}${i.path ? ` → ${i.path}` : ''}\n    ${i.message}`);
    return 1;
  }
  console.log(`Registry valid: ${records.length} anchor record(s) in ${files} file(s).`);
  return 0;
}

async function schema(check: boolean): Promise<number> {
  const generated = anchorJsonSchema();
  if (!check) {
    await writeFile(SCHEMA_FILE, generated);
    console.log(`Wrote ${SCHEMA_FILE}`);
    return 0;
  }
  const current = await readFile(SCHEMA_FILE, 'utf8').catch(() => '');
  if (current !== generated) {
    console.error(
      `${SCHEMA_FILE} is out of date. Run "pnpm schema:generate" and commit the result.`,
    );
    return 1;
  }
  console.log(`${SCHEMA_FILE} is up to date.`);
  return 0;
}

const [command, ...args] = process.argv.slice(2);
const code =
  command === 'validate'
    ? await validate(args[0] ?? 'registry')
    : command === 'schema'
      ? await schema(args.includes('--check'))
      : (console.error('Usage: cli.ts validate [dir] | schema [--check]'), 2);
process.exit(code);
