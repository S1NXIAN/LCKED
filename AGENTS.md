# LCKED — Password manager

A local-first password manager built with Next.js, Tailwind CSS, and Radix UI. Data stays in the browser — no backend, no sync.

## Toolchain

Bun owns this repo (`bun.lock`). Run one-off tool binaries via `bunx`, not
`npx` — e.g. `bunx tsc --noEmit`, `bunx eslint <files>`,
`bunx vitest run <file>`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Browser automation

Driving the UI (smoke tests, verification): read `docs/puppeteer/GUIDE.md` first — failure-signal → recovery recipes for the `xd://browser` harness, plus one-job-per-script helpers in `docs/puppeteer/scripts/`.

### Domain docs

Single-context layout — one `CONTEXT.md` at the repo root (once created), with ADRs in `docs/adr/`. See `docs/agents/domain.md`.
