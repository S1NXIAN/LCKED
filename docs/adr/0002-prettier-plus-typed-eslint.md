# Prettier owns formatting; ESLint runs gold-standard typed rules

The repo had an ESLint flat config with ~25 rules force-disabled and no
formatter, so style was manual and lint caught almost nothing. We adopted
Prettier (with `prettier-plugin-tailwindcss`) as the single formatting
authority, kept ESLint for correctness with typescript-eslint's
`recommendedTypeChecked` rule set via `projectService`, added
`eslint-config-prettier/flat` last so the two never fight, and enforced
import order with `simple-import-sort`. Enforcement is editor-side
(format-on-save via committed `.vscode/settings.json`) plus npm scripts —
no pre-commit hooks or CI at this repo size.

## Considered options

- **Typed linting demoted to plain `recommended`** — rejected: type-aware
  rules (floating promises, unsafe `any` propagation, misused promises) are
  the actual value.
- **Full strictness everywhere** — triage showed three legitimate noise
  pockets, each scoped rather than global-off: test mocks (`vi.fn(async …)`,
  unbound methods in `expect()`) relax the typed family inside `__tests__`;
  third-party import parsers (`bitwarden.ts`, `lcked.ts`) parse untyped JSON
  of unknown shape by design, so `no-unsafe-*` **and** `no-explicit-any` are
  off there (and only there — explicit `any` is an error everywhere else);
  async JSX event handlers keep `no-misused-promises` but with
  `checksVoidReturn` attributes/properties off. Everything else in the
  preset runs at shipped defaults, including `no-explicit-any`,
  `ban-ts-comment`, and `prefer-as-const`.
- **Merging simple-import-sort's default groups** — rejected; the plugin's
  stock five groups ship unchanged so contributors match the docs.
- **Pre-commit hooks (husky/lint-staged)** — deferred until a second
  regular contributor exists.

## Consequences

- `npm run format` / `format:check` / `lint` / `lint:fix` are the gates.
- Deliberate deps-array choices are silenced per-site with an explanatory
  comment (see `auto-lock-manager.tsx`, `item-editor/index.tsx`), never by
  disabling `exhaustive-deps` repo-wide — it warns, it doesn't block.
- The first format commit touched most files; use `git blame --first-parent`
  or skip to `style:` commits when tracing older lines.
