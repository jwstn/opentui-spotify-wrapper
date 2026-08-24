# Handoff: Spotify TUI using the ghui Effect/opentui architecture

**Date:** 2026-08-24
**Source session:** Architecture analysis of `/home/jw/Code/ghui` (Effect v4 beta terminal GitHub client).
**Next-session goal:** Start building a **Spotify TUI** (opentui + React 19 + Effect) reusing ghui's architecture and best practices.

---

## What this handoff contains

1. Architecture findings from analyzing ghui (a fresh agent cannot see the prior conversation, so these are captured here).
2. Transferable best practices detected in the ghui repository.
3. A proposed mapping onto a Spotify TUI, plus open questions to resolve first.
4. Pointers into the ghui repo — read those files instead of trusting this summary.

## Primary references (ghui repo at `/home/jw/Code/ghui`)

- `AGENTS.md` — repo conventions, release process, commit-readiness checks.
- `plans/README.md` + existing plans — Why/What/API-mapping/Open-questions/Status plan format used before non-trivial work.
- Stack: `effect@4.0.0-beta.90`, `@effect/atom-react`, `@effect/sql-sqlite-bun`, `@opentui/core`+`@opentui/react@0.4.2`, `react@19.2.7`, Bun runtime.

## Architecture findings

### Two halves that meet at mount time

```
React half                                Effect half
─────────────────────                     ──────────────────────────────────
src/index.tsx                             src/services/runtime.ts
  createCliRenderer                         githubRuntime = Atom.runtime(
  lazy-import @effect/atom-react + App        Layer.mergeAll(services…)
  <RegistryProvider><App/>                      .pipe(Layer.provide(CommandRunner.layer),
      │                                               Layer.provideMerge(Observability.layer)))
      │ creates AtomRegistry.make({          │
      │   scheduleTask: react scheduler,     │ every atom built via
      │   defaultIdleTTL: 400 })             │ githubRuntime.atom(...) / .fn(...)
      ▼                                      │ carries a ref to this runtime
  hooks call registry.mount(atom) ───────────┘
                                           → Layer builds lazily ONCE (shared MemoMap)
                                           → Context{services} available to all atoms
                                           → AsyncResult lands in registry → React rerenders
```

Key mechanics:

- **Atoms are module-level singletons.** State never lives in React state except tiny local concerns. Atoms needing services come from the runtime; plain `Atom.make` atoms need no runtime.
- **The Layer graph is embedded in atoms**, not provided via a separate provider. There is no `AtomRuntimeProvider` — `RegistryProvider` only supplies the `AtomRegistry` (the store).
- **Lazy single build:** the runtime's Layer builds on first atom evaluation via `Layer.buildWithMemoMap` against a shared `MemoMap`; all runtime atoms share the resulting services.
- **Mounting = refcounting:** `useAtom*` hooks mount atoms in `useEffect` (refcount + idle-TTL eviction). `Atom.keepAlive` pins forever; `.pipe(Atom.setIdleTTL(0))` evicts immediately on unmount (used for per-item dynamic atoms).
- **Async results are `AsyncResult`** (Initial/Success/Failure/Waiting); read via `useAtomValue` or driven imperatively via `Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }))`.
- **Commands ride the same rails:** `dispatchCommandAtom = githubRuntime.fn<string>()(dispatchCommand)`; keymap handlers invoke it via `useAtomSet(..., { mode: "promise" })`, so keyboard actions execute as Effects with full service access.
- **Edge escape hatches only:** `Effect.runPromise` appears at ~10 boundaries (theme persistence, imperative loaders, boot-time config via `runSync`). Everything else stays composed inside atoms/effects.

### Where to read what in ghui

| Topic | File |
|---|---|
| Runtime/Layer composition, mock-vs-real swap | `src/services/runtime.ts` |
| Service definition pattern | `src/services/GitHubService.ts` (`Context.Service` + static `layerNoDeps`) |
| SQLite cache service + migrator | `src/services/CacheService.ts` |
| OTLP observability layer (env-gated, empty by default) | `src/observability.ts` |
| Main data atom (cache-first fetch pipeline, retry w/ Schedule) | `src/ui/pullRequests/atoms.ts` (`pullRequestsAtom`) |
| Hook-bundle pattern | `src/hooks/useGitHubActions.ts` |
| Hub hook owning ALL wiring | `src/hooks/useAppShell.ts` |
| Imperative loader via registry | `src/hooks/useDiffLoader.ts` |
| Command dispatch through runtime | `src/commands/dispatch.ts` |
| Entry/mount with startup logo + lazy import | `src/index.tsx` |
| Pagination queue/retry logic feeding atoms | `src/item/load.ts`, `queue.ts`, `retry.ts` |
| Tests building own Layers/registries (no React) | `test/*.test.ts` |

## Best practices worth reusing (detected in this repo)

1. **Single global runtime, many module-singleton atoms.** One `Atom.runtime(layer)` export; atoms defined at module scope. No runtime plumbing through props/context beyond `RegistryContext`.
2. **Service = `Context.Service` class with static layer factories.** `layerNoDeps` (needs nothing), `layer` (with deps), plus env-gated swaps (`GHUI_MOCK_PR_COUNT ? MockGitHubService : GitHubService.layerNoDeps`) enabling offline development. Do the same: `MockSpotifyService` for dev without credentials.
3. **Thin service interfaces over CLIs/processes.** GitHubService shells out to `gh`; parse responses with Schema at the boundary (`githubSchemas.ts` + `githubNormalize.ts` pattern). A Spotify TUI wraps Web API / `spotify_player` / MPRIS the same way.
4. **Schema at every boundary.** Raw JSON → `Schema.Struct` decode → typed domain objects in `domain.ts`. Cache rows likewise (`CacheService` persists decoded structs).
5. **Hooks-bundle pattern:** group every `useAtomSet` for one concern into one hook returning named callbacks (`useGitHubActions`). Surfaces consume callbacks, not raw setters.
6. **Hub-hook + dumb-layout component:** all state/hooks/wiring in `useAppShell`; `App.tsx` is pure JSX consuming the shell bundle.
7. **Cache-first rendering:** list atoms read in-memory/SQLite cache instantly and refresh in background; optimistic mutations via overrides atoms + rollback records.
8. **Explicit eviction policy per atom:** `keepAlive` for hot small state; `setIdleTTL(0)` for heavy per-item payloads; capped record caches with LRU-style trim helpers (`recordCap.ts`).
9. **Retry with Schedule + progress atom** (`item/retry.ts` writes progress to a keepAlive atom the footer renders).
10. **Boot UX:** create renderer immediately, show animated startup logo, lazily import the heavy app bundle, then swap in `<RegistryProvider><App/>`.
11. **Env-gated observability:** OTLP tracer/logger layer resolving to `Layer.empty` unless endpoint env vars set — zero-cost when off.
12. **Tests without React:** construct `AtomRegistry.make()` directly, drive atoms with `Atom.set`/`getResult`, assert on `AsyncResult` states.
13. **Process hygiene:** alternate-screen, focus-reporting escape codes, suspend/resume for handing the terminal to `$EDITOR` (`tuiSuspension.ts`) — reusable for any TUI that opens editors/browsers.
14. **Write a `plans/*.md` before non-trivial work** (Why/What/API mapping/Open questions/Status) — copy this convention into the new project.
15. **Repo hygiene gates before every commit:** `format:check`, `typecheck`, `lint`, `test`; changesets for user-facing changes (see ghui `AGENTS.md`).

## Suggested shape for the Spotify TUI (starting point, not gospel)

- `src/services/runtime.ts`: `spotifyRuntime = Atom.runtime(Layer.mergeAll(SpotifyService.layerNoDeps, CacheService.layerFromPath(...), Clipboard.layerNoDeps, BrowserOpener.layerNoDeps, PlayerTransport.layer).pipe(Layer.provide(AuthService.layer), Layer.provideMerge(Observability.layer)))`
- Atoms: `playlistsAtom`, `playlistTracksAtom(fn)`, `searchResultsAtom(fn)`, `nowPlayingAtom` (polled via `Schedule` or SubscriptionRef), queue-selection-style selection state, `noticeAtom`.
- Commands: port ghui's registry/dispatch pattern early (play/pause/next/like/open-in-browser/command palette).
- Dev mode: `SPOTIFY_MOCK=1` env → `MockSpotifyService` with fixtures (`mockFixtures.ts` pattern).

## Open questions for next session

1. **Playback control path:** Spotify Web API only controls *active devices*; decide between Web API + Connect, `spotify_player` daemon, dbus/MPRIS, or librespot. This determines whether `PlayerTransport` is a service or a separate process.
2. **Auth flow:** client credentials won't cover user actions; device-code/user-login OAuth + refresh token persisted via Schema in SQLite (reuse CacheService patterns).
3. **Polling vs push** for now-playing state (poll interval, pause when unfocused/suspended).
4. **Scope of v0:** browse/search/play vs library management, playlists, lyrics.

## Suggested skills

Call via the Skill tool:

- **`prototype`** — before committing to the state model, throwaway-check that the atom graph + playback-state model feels right.
- **`grill-me`** (or `grilling`) — stress-test the open questions above (especially playback transport choice) before writing the plan.
- **`research`** — delegate fact-gathering on Effect v4 beta API specifics (`Atom.fn` reactivityKeys, SubscriptionRef, Schedule) and Spotify auth/Web API constraints; captures findings as Markdown in-repo.
- **`domain-modeling`** — establish the glossary/domain types (Track, Playlist, Device, PlaybackState) before services, mirroring ghui's `domain.ts` discipline.
- **`tdd`** — the atom/service layers are highly testable without React (see ghui tests); build test-first where practical.
- **`implement-spec`** / **`implement`** — execute the resulting spec/tickets once the plan is settled.
- **`to-spec`** — if the next session starts from discussion rather than tickets, synthesize into a spec first.
