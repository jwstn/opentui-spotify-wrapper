# opentui-spotify-wrapper

A Spotify terminal UI built with opentui (React 19) + Effect v4 on Bun.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `jwstn/opentui-spotify-wrapper` via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` glossary + `docs/adr/` for decisions. See `docs/agents/domain.md`.

### Commit readiness checks

Before every commit or push of code changes, run all gates and make them pass:

- `bun run format:check` — formatting (oxfmt). If it fails, run `bun run format` and re-check.
- `bun run typecheck` — `tsc --noEmit`.
- `bun run lint` — oxlint.
- `bun run test` — bun test.

CI (`.github/workflows/ci.yml`) enforces the same gates on pushes to `main` and pull requests; do not rely on manual review to catch drift.

### Plans

Larger features and redesigns are captured in markdown under `plans/` before work starts: Why / What we'd ship / API-architecture mapping / Open questions / Out of scope / Status. Check `plans/` before taking on non-trivial work; see `plans/README.md` for the format and index.

## Best Pratices

Keep an eye on the opentui-react-effect-best-pratices.md and http-server.md for a clean style
