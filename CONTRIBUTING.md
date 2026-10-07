# Contributing to corridor-finder-registry

Issue templates, the code of conduct and the security policy are shared across the organization (see the `.github` repository).

## Two kinds of contribution

**Data** (`registry/anchors/*.yaml`): follow [docs/DATA_POLICY.md](docs/DATA_POLICY.md). Reviewers will open your sources, so cite exactly where each fact comes from. PRs containing unsourced or guessed values are closed.

**Tooling** (`src/`, `test/`, CI): keep changes within the issue's scope, add tests, and update docs when behaviour changes.

## Workflow

1. Comment on an open issue to be assigned before starting.
2. Fork, branch from `main`, keep the PR focused.
3. Run `pnpm check`. It runs what CI runs.
4. Open a PR linking the issue (`Closes #123`).

## Schema changes

The API and web app depend on the format. Do not change `src/schema.ts` without an agreed issue. If you do, run `pnpm schema:generate` and commit `schema/anchor.schema.json`.

## Do not

- Add records from memory, from an AI assistant's answer, or from unverifiable sources.
- Copy values from the test fixture. It is invented.
- Commit secrets.
