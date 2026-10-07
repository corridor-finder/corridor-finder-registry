# Record format

One anchor per file: `registry/anchors/<id>.yaml`. A complete annotated example (invented values) lives in
[`test/fixtures/valid-registry/anchors/example-anchor.yaml`](../test/fixtures/valid-registry/anchors/example-anchor.yaml).

```text
anchor
├─ schema_version, id, name, home_domain, website?
├─ sep_support?            sourced list of SEP numbers
└─ services[]              one per country and direction
   ├─ country, direction, verification
   ├─ assets               sourced   (required)
   ├─ fiat_currencies      sourced   (required)
   └─ payment_rails? fees? limits? speed?   sourced, omitted when unknown
```

The schema source of truth is [`src/schema.ts`](../src/schema.ts). `schema/anchor.schema.json` is generated from it for editor autocompletion (`pnpm schema:generate`); CI fails if it is stale.
Add this first line to a record to get autocompletion in VS Code with the YAML extension:

```yaml
# yaml-language-server: $schema=../../schema/anchor.schema.json
```

Schema changes bump `schema_version` and are discussed in an issue first, because the API and web app depend on it.
