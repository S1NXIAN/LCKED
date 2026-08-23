## Naming

- Names reveal intent: a name tells you why a thing exists, what it does,
  and how it is used. A name that needs a comment to explain it is a naming
  failure — rename it, don't annotate it.
- Methods and functions are verbs that say what they do (`fetch_user`,
  `validate_input`); classes, structs, and types are nouns (`UserSession`,
  `CommandRegistry`).
- No vague names: `data`, `stuff`, `tmp2` do not survive review.
- One concept, one name. The repo's glossary, where the repo keeps one,
  records the ubiquitous language; when code and glossary disagree, one of
  them is wrong — fix one, never both.
- Abbreviations are allowed only when they are the domain's own words
  (SSID, MCP); never coin private abbreviations.
- When in doubt, match the surrounding code: local consistency outweighs
  personal preference. Changing the codebase's style is its own change,
  argued on its own.

## Comments

A comment provides information the code itself cannot contain: why the code
is there, which invariant it maintains, which failure mode a guard prevents.

- The one mandatory comment is a function contract: what the code cannot
  show — invariants, edge-case behaviour, what the return value means —
  present tense, never the change that produced it.
- Inline comments are for the non-obvious only: why this order matters,
  which guard is load-bearing. If a reader could write the line from the
  comment, the comment is redundant.
- Comments that contradict the code are worse than no comments — a stale
  comment is rewritten or deleted, never left.
- Never comment out code, and never keep changelog-style comments — the
  commit history owns both.

## Modules and seams

- Prefer deep modules: a module's interface should be much simpler than its
  implementation. A shallow module hides little and just adds a call layer.
  Consider at least two designs before choosing one.
- A module owns its seam: it is the one place that touches its shared state,
  and callers reach it through that point. A second implementation beside an
  existing one is prohibited — extend the existing module or make the case
  for replacing it.
- A function that returns a value does not print its result; output is the
  caller's decision.
- Fail loudly: never swallow errors — an error a caller cannot see is a bug.
- Never build for futures you cannot name: if the use case isn't real today,
  it is speculation — ship the simplest version, build the future version
  when the future arrives.
- One behaviour, one home: changing a behaviour is a one-file edit. If a
  change forces identical edits across many files, the seam is wrong — fix
  the seam, not the callers.

## Testing

- Every behaviour change ships with the smallest test that fails if the
  behaviour regresses.

## Review

- No change merges unreviewed: a second pair of eyes is the last and
  cheapest quality gate.

## Git

- Conventional Commits, per the spec at conventionalcommits.org: a type, a
  required scope — the part of the codebase the change touches — and a
  description (`fix(parser): handle empty input`); the spec leaves scope
  optional, requiring it is a house position. The
  spec mandates only `fix` and `feat`; the house set is
  `feat`, `fix`, `refactor`, `docs`, `test` — a type outside the set is
  fine when it plainly fits (`perf`, `build`); lower-case types are a house
  convention, not a spec rule.
- One logical change per commit: a single logical change is contained within
  a single commit; when a change spans two types, split it.
- Subject line: imperative mood ("fix", not "fixes" or "fixed"), 50
  characters or fewer, followed by a blank line and a body where needed —
  the body explains why the change exists, never narrates the diff.

