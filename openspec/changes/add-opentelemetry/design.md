## Context

The codebase has no structured observability. All runtime output is via raw `console.*` calls in two entrypoints (`server/src/index.ts`, `cli/src/program.ts`). `ServerConfig` already parses `CORTEX_LOG_LEVEL` from env but never uses it. The OTel JS SDK supports Bun via the standard `@opentelemetry/sdk-*` packages (they are pure-TS, no native bindings required for console exporters).

## Goals / Non-Goals

- **Goals**
    - Define a `Logger` port in core; keep OTel as an implementation detail
    - Inject logger via `CortexContext` — consistent with the existing DI pattern
    - Console exporters only — no OTLP collector required to see output
    - Zero breaking changes — `logger` is optional; all existing code and tests pass without modification
    - Wire the existing `logLevel` env var so it actually does something

- **Non-Goals**
    - OTLP/Jaeger/Datadog exporters (follow-up)
    - Metrics (`@opentelemetry/sdk-metrics`) — follow-up
    - Auto-instrumentation of HTTP layer — follow-up
    - Semantic conventions beyond `rpc.method`/`error.type` attributes on tool spans

## Decisions

- **Logger port lives in `core`** — follows hexagonal architecture; core owns ports, entrypoints provide implementations. The `Logger` interface has no OTel import; core stays dependency-free.
- **OTel SDK only in `packages/server`** — the CLI uses a plain `ConsoleLogger` (no SDK). This keeps the CLI binary small and avoids OTel startup overhead in interactive use.
- **`CORTEX_OTEL_ENABLED` opt-in flag** — the full OTel SDK (TraceProvider + LoggerProvider) only activates when `CORTEX_OTEL_ENABLED=true`. Default path is a lean `ConsoleLogger` that writes structured JSON lines, so users get structured logs without installing a collector.
- **`withSpan` helper pattern** — a thin wrapper function (not a decorator) avoids TypeScript decorator complexity and keeps instrumentation readable and testable. Each tool handler calls `withSpan(tracer, toolName, storeName, async () => { ... })`.
- **`ConsoleLogger` stderr, OTel stdout** — OTel's `ConsoleLogRecordExporter` and `ConsoleSpanExporter` write to stdout by default. The plain `ConsoleLogger` writes to stderr so it doesn't pollute MCP message framing on stdout.

## Risks / Trade-offs

- OTel JS SDK is Node-oriented; some internals use `process.hrtime`, `process.env`, etc. These are all Bun-compatible. The console exporters specifically have no native deps.
- `bun build --compile` bundles all deps. OTel SDK is larger than current zero-dep server. Acceptable for first pass; can tree-shake later.
- Span context propagation across async boundaries requires `AsyncLocalStorage` — Bun supports this natively.

## Open Questions

- Should `withSpan` propagate W3C trace context from incoming MCP HTTP headers? Deferred — no distributed tracing consumer yet.
- Should the `ConsoleLogger` JSON format follow OTel log record schema or a simpler `{level, msg, ts}` shape? Use simpler shape for now; easy to upgrade.
