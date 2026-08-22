# Layer-first layout and `__tests__/` test convention

The codebase keeps Next.js's layer-first shape (`src/app`, `src/components`,
`src/lib`, `src/store`) rather than feature folders: LCKED is a single-context
repo (see CONTEXT.md) with one deployable, so feature directories would encode
a boundary the domain doesn't have. Within `lib/`, modules are grouped by
domain — `vault/`, `items/`, `generator/`, `search/`, `import/` — but a module
whose directory name would just duplicate its file name (`crypto/crypto.ts`,
`totp/totp.ts`) stays flat; a concept earns a directory when it has more than
one file. Tests live in a sibling `__tests__/` directory of whatever they test
(never co-located), with parser fixtures beside them in
`lib/import/__fixtures__/`.

## Considered options

- **Feature-first** (`src/features/<domain>/` owning components + lib + tests):
  rejected as speculative structure for a solo local-first app; revisit if a
  second context ever appears.
- **Co-located tests** (`foo.test.ts` beside `foo.ts`): rejected; grouped
  `__tests__/` keeps source directories readable and mirrors the pre-existing
  convention in `lib/import/`.
- **Renaming moved files**: rejected; moves rewrite import specifiers only.
  File names stay stable so history and blame survive.

## Constraints

- `src/components/ui/` is shadcn CLI territory — pinned by `components.json`
  aliases, never hand-moved.
- `src/app/` layout is fixed by the Next.js App Router.
- The zustand store stays in `src/store/vault.ts`: it is app state, not a
  domain module.
