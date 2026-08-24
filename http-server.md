# Effect HTTP Server Practices

Best practices for hosting, wiring, and operating an Effect HTTP server.
Route-level handler patterns live in [`routes.md`](./routes.md); this file
covers everything around them.

## Hosting

Serve a layer, not a callback. The route tree is an `HttpApiBuilder.layer`
(or `HttpRouter`) wrapped in `HttpRouter.serve(...)`, and the transport is
`NodeHttpServer.layer(...)` underneath:

```ts
const listener = HttpRouter.serve(routesLayer).pipe(
  Layer.provideMerge(NodeHttpServer.layer(() => server, { port, host })),
)
```

Build the layer into a `Scope` you own so stopping the server is scope
closure. Do not hand-roll started/stopped flags next to it.

- One listener = one scope. Finalizers (WebSocket trackers, mDNS
  unpublish, database pools) hang off that scope and run on close.
- Prefer port `0` with an address read-back over probing free ports
  yourself; if you need a preferred port first (e.g. 4096), fall back to
  `0` by catching the bind failure, not by pre-checking availability.
- Read the bound address from `HttpServer.HttpServer` after the layer is
  built; never assume the configured port was used.
- Force-close semantics belong in one place: wrap `server.close` once if
  `stop(force)` must also drop live sockets, and keep graceful-shutdown
  timeouts in the platform layer config.

## Layer Wiring

- Declare each service as a layer (`Layer.effect(Service, ...)`, or a
  `LayerNode` when using `AppNodeBuilder`) and compose the graph once at
  the assembly boundary. Request handlers should never call
  `Effect.provide(SomeLayer)`.
- Yield stable services once while building handler layers, then close
  over them. Re-yielding per request hides real dependencies from the
  type system and rebuilds memoized layers.
- Keep request-derived context (instance refs, workspace routing,
  auth principal) separate from stable services. Middleware may
  `Effect.provideService(...)` for request context only.
- Install a fresh `ConfigProvider.layer(ConfigProvider.fromEnv())` per
  listener if `Config.*` reads must observe current `process.env`; the
  default provider snapshots env on first read and caches forever.

## Contracts

- Declare endpoints as typed `HttpApi` groups: schemas for path, query,
  payload, success, and errors on the endpoint, not ad hoc parsing in
  handlers.
- SSE endpoints stay in `HttpApiBuilder.group(...)` and return
  `HttpServerResponse.stream(...)`; annotate the success schema with
  `HttpApiSchema.asText({ contentType: "text/event-stream" })` so OpenAPI
  documents the stream.
- Use `handleRaw(...)` for endpoints that need the raw request/response,
  including WebSocket upgrades. Raw `HttpRouter` routes are for surfaces
  outside the API contract (static UI fallback, health checks).
- Generate OpenAPI from the contract itself; treat post-processing shims
  as debt to shrink, not infrastructure to extend.

## Errors

- Translate expected domain errors at the handler boundary into
  endpoint-declared error schemas (`Schema.ErrorClass`). Handlers are the
  only place that knows both the domain error and the wire shape.
- Middleware handles cross-cutting concerns plus one final
  unknown-defect fallback. It must not grow domain-specific error
  mapping or name checks.
- Never leak internal error text to clients; declared error bodies are
  the public contract. Log full causes server-side before translating.

## Streaming And Backpressure

- Return Effect `Stream`s directly to `HttpServerResponse.stream`;
  the platform applies backpressure between client consumption and
  upstream effects. Avoid collecting a stream into memory to then
  stringify it.
- For event fan-out, push into a `Queue`/`PubSub` consumed by the
  response stream rather than writing to the socket imperatively.
- Clean up per-connection resources with stream scoping
  (`Stream.scoped`, `Effect.addFinalizer`) so disconnects release
  subscriptions even mid-stream.

## Concurrency And Lifecycle

- Background work (event bridges, cleanup loops) is forked into the
  listener scope at layer construction with `Effect.forkScoped`, never
  detached globally; it then dies with the scope on shutdown.
- Keep per-instance state behind scoped caches keyed by instance, not in
  module-level mutable maps keyed by string.
- Interruption is the cancellation mechanism: abort signals, client
  disconnects, and shutdown should all surface as fiber interruption,
  not boolean flags checked inside loops.

## Testing

- Test handlers through `HttpRouter.toWebHandler(routesLayer)` or an
  equivalent web handler; issue real `Request`s against it instead of
  binding ports.
- Replace service layers at the layer boundary (provide test layers under
  the same open contracts) instead of mocking globals or monkey-patching
  services.
- Assert on status, body schema, and declared error shapes — the same
  contract clients see.

## Checklist For Server PRs

- [ ] Listener lifetime is a single Scope; stop closes finalizers.
- [ ] Stable services are composed once at the assembly boundary.
- [ ] No `Effect.provide(Layer)` inside request handlers.
- [ ] Endpoint schemas declare success and error wire shapes.
- [ ] Domain-to-HTTP error translation lives in handlers.
- [ ] Streams flow to responses without buffering whole payloads.
- [ ] New background work is forked into the listener scope.
