# Data policy

This registry is only useful if people can trust it. These rules are enforced by the validator where possible and by reviewers where not.

## 1. Never fabricate

Fees, limits, speed, rails, countries and assets appear **only** when a source supports them. If you cannot find a source, **omit the field**. Downstream, omitted means "unavailable". Do not estimate, round, infer from a competitor, or fill gaps from memory or from an AI assistant's answer.

## 2. Every fact carries evidence

Each fact is `{ value, sources: [...] }`. A source has a public `https` URL, a `type` and the date you retrieved it (`retrieved_at`). Use the strongest source available:

| Type            | Use for                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| `stellar_toml`  | The anchor's `/.well-known/stellar.toml` (assets, issuers, endpoints)                |
| `sep_info`      | SEP-6 / SEP-24 / SEP-31 `/info` responses (assets, fees, limits)                     |
| `sep38_info`    | SEP-38 `/info` (country codes, delivery methods)                                     |
| `official_docs` | The anchor's own published documentation or help pages                               |
| `regulator`     | A licensing authority's public register                                              |
| `other`         | Anything else; explain in `note`. Press articles and social posts are weak evidence. |

## 3. Freshness

`retrieved_at` is the day you looked at the source, not the day the page claims to be updated. Records older than the project's freshness threshold are shown as stale to users.

## 4. Verification level

- `curated`: a person compiled the service from the listed sources.
- `anchor_confirmed`: the country and rails also match the anchor's own machine-readable data. Only claim this when you actually compared them.

## 5. Meaning of the fields

- `on_ramp`: local fiat in, Stellar asset out. `off_ramp`: Stellar asset in, local fiat out. `both`: the same service supports both.
- `fees.percent` is in percentage points: `"1.5"` means 1.5%. All amounts are decimal strings.
- A corridor existing in this data does **not** mean it is cheap, liquid or fast. Quality is not claimed unless a source states it.

## 6. What reviewers check

- Open every source URL and confirm it says what the record says.
- Confirm nothing is present without a source and no field is guessed.
- `pnpm check` passes.
