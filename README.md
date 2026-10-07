# corridor-finder-registry

The sourced dataset behind **Corridor Finder**: which Stellar anchors offer which assets, currencies and payment rails in which countries, with the evidence and retrieval date for every fact.

> Status: format, validator and CI exist. `registry/anchors/` is intentionally empty until real records are researched and verified. We do not ship placeholder data.

## Why a registry

Stellar's standards (SEP-1, 6, 24, 38) let anchors publish assets, fees and limits, and SEP-38 can list country codes, but support is optional and uneven. Countries and payment rails are not reliably machine-readable, so a human-curated, sourced record is the source of truth and scripts verify what they can.

**Hard rule:** no fact without a source. Unknown stays unknown. Read the [data policy](docs/DATA_POLICY.md) before contributing data.

## Repositories

[`corridor-finder`](https://github.com/corridor-finder/corridor-finder) hub ·
**[`corridor-finder-registry`](https://github.com/corridor-finder/corridor-finder-registry)** ·
[`corridor-finder-api`](https://github.com/corridor-finder/corridor-finder-api) ·
[`corridor-finder-web`](https://github.com/corridor-finder/corridor-finder-web)

## Quick start

Requires Node 22 and pnpm (`corepack enable`).

```bash
pnpm install
pnpm check            # lint, typecheck, format, schema, validate data, tests
pnpm validate:data    # validate registry/anchors/*.yaml
```

## Adding or updating a record

1. Read [docs/DATA_POLICY.md](docs/DATA_POLICY.md) and [docs/SCHEMA.md](docs/SCHEMA.md).
2. Create `registry/anchors/<id>.yaml` (the file name must equal the `id`).
3. Run `pnpm validate:data`. Errors name the file and field.
4. Open a PR listing, for each fact, where you found it.

## Layout

| Path                            | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `registry/anchors/`             | The data (CC BY 4.0)                           |
| `src/schema.ts`                 | Zod schema, the source of truth for the format |
| `src/validate.ts`, `src/cli.ts` | Validator and CLI                              |
| `schema/anchor.schema.json`     | Generated JSON Schema for editors              |
| `test/`                         | Tests and a fake example record                |

## Licensing

Code and tooling: [Apache-2.0](LICENSE). Data in `registry/`: [CC BY 4.0](DATA_LICENSE). Attribute "Corridor Finder contributors". This is not legal advice.
