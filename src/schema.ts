import { z } from 'zod';

/**
 * Registry schema v1.
 *
 * Design rule: a fact only exists in the registry together with the evidence for it.
 * Every non-trivial fact is wrapped in `sourced(...)`, which requires at least one source with a
 * retrieval date. Anything we cannot source is simply left out and is "unavailable" downstream.
 */

export const SCHEMA_VERSION = 1;

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase letters, digits and single hyphens');

export const IsoDate = z.iso.date();

export const HttpsUrl = z.url().refine((u) => u.startsWith('https://'), 'must start with https://');

/** Money and rates are decimal strings so no float rounding ever touches them. */
export const Decimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'must be a decimal string such as "1.5" (digits only, no units)');

export const CountryCode = z
  .string()
  .regex(/^[A-Z]{2}$/, 'must be an ISO 3166-1 alpha-2 code in capitals, e.g. "NG"');

export const CurrencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, 'must be an ISO 4217 code in capitals, e.g. "NGN"');

export const StellarAsset = z.strictObject({
  code: z.string().regex(/^[A-Za-z0-9]{1,12}$/, '1-12 letters or digits'),
  issuer: z.string().regex(/^G[A-Z2-7]{55}$/, 'must be a Stellar public key (G..., 56 chars)'),
});

export const SOURCE_TYPES = [
  'stellar_toml',
  'sep_info',
  'sep38_info',
  'official_docs',
  'regulator',
  'other',
] as const;

export const Source = z.strictObject({
  url: HttpsUrl,
  type: z.enum(SOURCE_TYPES),
  /** The day a human or script actually looked at this source. Drives freshness display. */
  retrieved_at: IsoDate,
  note: z.string().min(1).optional(),
});

export function sourced<T extends z.ZodType>(value: T) {
  return z.strictObject({
    value,
    sources: z.array(Source).min(1, 'at least one source is required for every fact'),
  });
}

export const RAIL_TYPES = [
  'bank_transfer',
  'mobile_money',
  'cash',
  'card',
  'wallet',
  'other',
] as const;

export const PaymentRail = z.strictObject({
  type: z.enum(RAIL_TYPES),
  /** Local brand or scheme, e.g. "M-Pesa". Optional. */
  name: z.string().min(1).optional(),
});

const unit = z.string().regex(/^[A-Za-z0-9]{1,12}$/, 'asset code or currency code');

/** `percent` is in percentage points: "1.5" means 1.5%. */
export const Fees = z
  .strictObject({
    fixed: Decimal.optional(),
    percent: Decimal.optional(),
    minimum: Decimal.optional(),
    unit: unit.optional(),
  })
  .refine((f) => f.fixed !== undefined || f.percent !== undefined || f.minimum !== undefined, {
    message: 'provide at least one of fixed, percent, minimum',
  })
  .refine((f) => (f.fixed === undefined && f.minimum === undefined) || f.unit !== undefined, {
    message: 'unit is required when fixed or minimum is set',
    path: ['unit'],
  });

export const Limits = z
  .strictObject({ min: Decimal.optional(), max: Decimal.optional(), unit })
  .refine((l) => l.min !== undefined || l.max !== undefined, {
    message: 'provide at least one of min, max',
  })
  .refine((l) => l.min === undefined || l.max === undefined || Number(l.min) <= Number(l.max), {
    message: 'min must not exceed max',
    path: ['min'],
  });

export const Speed = z
  .strictObject({
    min_minutes: z.number().int().nonnegative().optional(),
    max_minutes: z.number().int().nonnegative().optional(),
  })
  .refine((s) => s.min_minutes !== undefined || s.max_minutes !== undefined, {
    message: 'provide at least one of min_minutes, max_minutes',
  })
  .refine(
    (s) =>
      s.min_minutes === undefined || s.max_minutes === undefined || s.min_minutes <= s.max_minutes,
    { message: 'min_minutes must not exceed max_minutes', path: ['min_minutes'] },
  );

export const DIRECTIONS = ['on_ramp', 'off_ramp', 'both'] as const;
export const VERIFICATION_LEVELS = ['curated', 'anchor_confirmed'] as const;

/**
 * What an anchor offers in one country.
 * on_ramp  = local fiat in, Stellar asset out (deposit).
 * off_ramp = Stellar asset in, local fiat out (withdrawal).
 */
export const Service = z.strictObject({
  country: CountryCode,
  direction: z.enum(DIRECTIONS),
  assets: sourced(z.array(StellarAsset).min(1)),
  fiat_currencies: sourced(z.array(CurrencyCode).min(1)),
  payment_rails: sourced(z.array(PaymentRail).min(1)).optional(),
  fees: sourced(Fees).optional(),
  limits: sourced(Limits).optional(),
  speed: sourced(Speed).optional(),
  /**
   * curated          = a human compiled this from the listed sources.
   * anchor_confirmed = country/rails also match the anchor's own machine-readable data (e.g. SEP-38 /info).
   */
  verification: z.enum(VERIFICATION_LEVELS),
});

export const Anchor = z
  .strictObject({
    schema_version: z.literal(SCHEMA_VERSION),
    id: slug,
    name: z.string().min(1),
    /** The SEP-1 home domain that serves /.well-known/stellar.toml. */
    home_domain: z
      .string()
      .regex(
        /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/,
        'bare lowercase hostname, no scheme or path',
      ),
    website: HttpsUrl.optional(),
    /** SEP numbers the anchor supports, e.g. [6, 24, 38]. */
    sep_support: sourced(z.array(z.number().int().positive()).min(1)).optional(),
    services: z.array(Service).min(1, 'an anchor needs at least one service'),
  })
  .superRefine((anchor, ctx) => {
    const seen = new Map<string, Set<string>>();
    anchor.services.forEach((s, i) => {
      const dirs = seen.get(s.country) ?? new Set<string>();
      const conflict =
        dirs.has(s.direction) || dirs.has('both') || (s.direction === 'both' && dirs.size > 0);
      if (conflict) {
        ctx.addIssue({
          code: 'custom',
          path: ['services', i, 'direction'],
          message: `overlapping service for ${s.country}: each country may have on_ramp and off_ramp, or a single "both" entry, never duplicates`,
        });
      }
      dirs.add(s.direction);
      seen.set(s.country, dirs);
    });
  });

export type Anchor = z.infer<typeof Anchor>;
export type Service = z.infer<typeof Service>;
