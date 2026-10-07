/* eslint-disable @typescript-eslint/no-explicit-any -- tests mutate loosely-typed YAML fixtures */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse, stringify } from 'yaml';
import { readFileSync } from 'node:fs';
import { anchorJsonSchema } from '../src/json-schema.js';
import { validateRegistry } from '../src/validate.js';

const TODAY = '2026-10-07';
const FIXTURE_DIR = resolve('test/fixtures/valid-registry');
const base = () => parse(readFileSync(join(FIXTURE_DIR, 'anchors/example-anchor.yaml'), 'utf8'));

/** Writes records to a temp registry as `<name>.yaml` and validates it. */
async function run(files: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), 'cf-reg-'));
  mkdirSync(join(root, 'anchors'));
  for (const [name, data] of Object.entries(files)) {
    writeFileSync(
      join(root, 'anchors', `${name}.yaml`),
      typeof data === 'string' ? data : stringify(data),
    );
  }
  return validateRegistry(root, { today: TODAY });
}

const messages = (r: Awaited<ReturnType<typeof run>>) =>
  r.issues.map((i) => `${i.path}: ${i.message}`);

describe('valid data', () => {
  it('accepts the example fixture file as shipped', async () => {
    const r = await validateRegistry(FIXTURE_DIR, { today: TODAY });
    expect(r.issues).toEqual([]);
    expect(r.records).toHaveLength(1);
  });

  it('accepts an anchor with only the required facts', async () => {
    const a = base();
    a.services[0] = {
      country: 'KE',
      direction: 'on_ramp',
      verification: 'curated',
      assets: a.services[0].assets,
      fiat_currencies: a.services[0].fiat_currencies,
    };
    const r = await run({ 'example-anchor': a });
    expect(r.issues).toEqual([]);
  });

  it('reads the country code NO as text, not as a YAML boolean', async () => {
    const a = base();
    a.services[0].country = 'NO';
    const text = stringify(a).replace(/country: ['"]?NO['"]?/, 'country: NO');
    const r = await run({ 'example-anchor': text });
    expect(r.issues).toEqual([]);
    expect(r.records[0].services[0].country).toBe('NO');
  });
});

describe('the no-fabrication rules', () => {
  it('rejects a fact with no sources', async () => {
    const a = base();
    a.services[0].fees.sources = [];
    expect(messages(await run({ 'example-anchor': a })).join('\n')).toMatch(/at least one source/);
  });

  it('rejects a fact with no sources key at all', async () => {
    const a = base();
    delete a.services[0].fiat_currencies.sources;
    expect((await run({ 'example-anchor': a })).issues.length).toBeGreaterThan(0);
  });

  it('rejects non-https source urls', async () => {
    const a = base();
    a.services[0].fees.sources[0].url = 'http://anchor.example.com/info';
    expect(messages(await run({ 'example-anchor': a })).join('\n')).toMatch(/https/);
  });

  it('rejects retrieved_at dates in the future', async () => {
    const a = base();
    a.services[0].fees.sources[0].retrieved_at = '2026-12-31';
    expect(messages(await run({ 'example-anchor': a })).join('\n')).toMatch(/in the future/);
  });

  it('rejects unknown keys, so typos cannot silently drop data', async () => {
    const a = base();
    a.services[0].fee = a.services[0].fees;
    expect((await run({ 'example-anchor': a })).issues.length).toBeGreaterThan(0);
  });
});

describe('value rules', () => {
  const cases: [string, (a: any) => void, RegExp][] = [
    [
      'float fee instead of decimal string',
      (a) => (a.services[0].fees.value.percent = 1.5),
      /expected string/i,
    ],
    ['fee unit missing', (a) => delete a.services[0].fees.value.unit, /unit is required/],
    [
      'invalid issuer key',
      (a) => (a.services[0].assets.value[0].issuer = 'NOTAKEY'),
      /Stellar public key/,
    ],
    ['lowercase country', (a) => (a.services[0].country = 'ng'), /ISO 3166/],
    ['bad currency', (a) => (a.services[0].fiat_currencies.value = ['naira']), /ISO 4217/],
    [
      'home domain with scheme',
      (a) => (a.home_domain = 'https://anchor.example.com'),
      /bare lowercase hostname/,
    ],
    [
      'empty fee object',
      (a) => (a.services[0].fees.value = {}),
      /at least one of fixed, percent, minimum/,
    ],
    [
      'limits min above max',
      (a) =>
        (a.services[0].limits = {
          value: { min: '10', max: '5', unit: 'USDC' },
          sources: a.services[0].fees.sources,
        }),
      /must not exceed max/,
    ],
    [
      'unknown rail type',
      (a) => (a.services[0].payment_rails.value = [{ type: 'carrier_pigeon' }]),
      /./,
    ],
    ['wrong schema version', (a) => (a.schema_version = 2), /./],
  ];
  it.each(cases)('rejects %s', async (_name, mutate, pattern) => {
    const a = base();
    mutate(a);
    const r = await run({ 'example-anchor': a });
    expect(messages(r).join('\n')).toMatch(pattern);
  });
});

describe('cross-record rules', () => {
  it('rejects duplicate country and direction within one anchor', async () => {
    const a = base();
    a.services.push({ ...a.services[0] });
    expect(messages(await run({ 'example-anchor': a })).join('\n')).toMatch(
      /overlapping service for NG/,
    );
  });

  it('rejects "both" alongside on_ramp for the same country', async () => {
    const a = base();
    a.services.push({ ...a.services[0], direction: 'on_ramp' });
    expect(messages(await run({ 'example-anchor': a })).join('\n')).toMatch(/overlapping service/);
  });

  it('allows on_ramp and off_ramp for the same country', async () => {
    const a = base();
    a.services[0].direction = 'on_ramp';
    a.services.push({ ...a.services[0], direction: 'off_ramp' });
    expect((await run({ 'example-anchor': a })).issues).toEqual([]);
  });

  it('requires the file name to match the id', async () => {
    expect(messages(await run({ 'wrong-name': base() })).join('\n')).toMatch(
      /file name must be "example-anchor.yaml"/,
    );
  });

  it('rejects duplicate ids', async () => {
    const r = await run({ 'example-anchor': base(), 'other-file': base() });
    expect(messages(r).join('\n')).toMatch(/duplicate id|file name must be/);
  });

  it('reports malformed YAML and duplicate YAML keys', async () => {
    const r = await run({ broken: 'id: a\nid: b\n' });
    expect(messages(r).join('\n')).toMatch(/invalid YAML/);
  });

  it('rejects non-yaml files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'cf-reg-'));
    mkdirSync(join(root, 'anchors'));
    writeFileSync(join(root, 'anchors', 'notes.txt'), 'hi');
    const r = await validateRegistry(root, { today: TODAY });
    expect(messages(r).join('\n')).toMatch(/only .yaml files/);
  });
});

describe('generated JSON schema', () => {
  it('matches the committed schema file', () => {
    expect(readFileSync('schema/anchor.schema.json', 'utf8')).toBe(anchorJsonSchema());
  });
});
