# Best Practices for opentui (React 19 + Effect) TUIs

Practices distilled from a production opentui app (`ghui`). Every item below is
project-agnostic: it applies to any opentui application using React for rendering
and Effect for runtime/services/state.

## Terminal lifecycle

- Run in **alternate-screen mode** and own your escape sequences explicitly
  (e.g. enable/disable focus reporting `\x1b[?1004h`/`\x1b[?1004l`).
- Force a **full repaint on start** and after resize (synthetic `SIGWINCH` +
  clear-screen sequence) to avoid stale artifacts from the previous buffer.
- Route quit through an **app command**, never raw Ctrl-C: set
  `exitOnCtrlC: false`, run cleanup (restore escape modes) in the renderer's
  destroy hook *before* `process.exit`.
- Bridge **subprocess hand-off** (editors, pagers) through a tiny suspender
  module — consumers call `withTuiSuspended(run)`; the entry point registers
  real suspend/resume against the renderer. Resume must happen in `finally`
  and trigger a full repaint, so a failed subprocess launch can never leave
  the terminal broken. When unregistered (tests/headless), it degrades to
  just calling `run()`.

## Architecture

- **Dumb renderer, smart shell**: components are pure JSX manifests; all
  state, hooks, derivations, keymap wiring, and side-effects live in one hub
  hook per screen/app.
- **State lives in Effect atoms, not React state.** Module-level singleton
  atoms; updates reach components through a single `AtomRegistry` provided
  once at the root (`RegistryProvider`) and consumed via
  `useSyncExternalStore` under the hood. No prop drilling, no cascading
  re-renders.
- Bind services once with `Atom.runtime(Layer...)`; atoms needing services
  are built from that runtime so the layer builds lazily exactly once and is
  shared. Plain atoms need no runtime.
- Keep logic out of the render path so it is **testable headlessly**:
  construct an `AtomRegistry` directly in tests, drive atoms with
  `Atom.set`/registry reads, assert on `AsyncResult` values — no pty, no DOM.
- Use imperative escape hatches sparingly and only at edges: a few
  `Effect.runPromise(...)` call sites (persistence, prefetch loaders,
  boot-time config). Everything else stays composed inside atoms/effects.

## Input & keymap

- Structure keys as a **layered keymap gated by context flags** (which view
  or modal is active) instead of scattering conditionals through handlers.
- Funnel all keyboard input through a **single adapter/listener** per
  component tree to prevent stacked duplicate handlers firing twice.
- Treat **paste as input routing**, not an afterthought: route pasted text
  contextually (focused text field, command palette, URL input) like keys.
- Give commands a **reactive `disabledReason`** checked centrally at
  dispatch time — gating becomes inspectable state instead of scattered
  boolean logic, and dispatching a disabled command is a safe no-op.

## Layout & responsiveness

- **Compute layout once per render** from terminal dimensions into a plain
  data object; derive split panes, widths, and visibility flags from width
  thresholds. Components consume numbers, never measure.
- Enforce a **minimum terminal size** with an explicit gate screen showing
  required vs actual dimensions.
- Centralize modal chrome (borders, titles, dividers/junction characters) in
  **one modal-frame component**; document the character conventions (e.g.
  side borders meeting horizontal dividers with `├`/`┤`) so ad-hoc dividers
  can't look detached.

## Lists, selection & scroll

- **Persist scroll positions** per list across surface/view switches;
  remounted scrollboxes otherwise reset to top and visibly jump.
- Auto-scroll the selected row into view; use a dedicated follow-selected
  helper rather than relying on renderer auto-focus behavior.
- **Clamp selection indices** whenever list lengths shrink (filters, refresh)
  so the cursor can never dangle out of bounds.
- Render **"load more" as a selectable row** at the end of the list rather
  than a separate control; loading-more shows inline status in that slot.

## Async & feedback

- Render **cache-first**: display the previous/cached data immediately and
  refresh in the background; never blank a panel while refetching.
- Apply mutations **optimistically** with rollback records so failures
  restore prior state instead of desyncing the UI.
- Use **one global notice/toast atom with centralized auto-expiry** in a
  top-level effect — every writer's message expires, including ones written
  from outside the UI timer helper.
- Report long operations as **progress state in the footer/status bar**
  (retry counts, fetch progress) driven by atoms.
- Share a **single spinner interval/frame counter** across the app instead
  of one timer per animated element.

## Boot & performance

- Achieve **instant first paint**: create the renderer and show a lightweight
  startup screen immediately; lazy-import the heavy app bundle behind it and
  swap it in when loaded.
- **Cap in-memory caches** (per-item payloads, derived maps) with LRU-style
  trimming so long sessions don't accumulate unbounded memory.
- Make eviction policy explicit per atom: pin hot small state with
  `keepAlive`; let heavy per-item payloads evict aggressively
  (`setIdleTTL(0)`).

## Developer experience

- Provide a **deterministic mock mode** toggled by env var that swaps the
  real service layer for fixture-backed mocks (Effect layers make this a
  one-line composition change) — enables offline development of the entire
  UI.
- Gate debug output behind **env-var-controlled structured logging**
  (`devLog`, optional log-file paths); never leave stray console writes.
- Gate optional telemetry (traces/logs export) behind env vars so the layer
  resolves to empty — zero cost when off.
