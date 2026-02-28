## 1. Core — Logger port

- [x] 1.1 Add `Logger` interface to `packages/core/src/types.ts` with `debug`, `info`, `warn`, `error(msg, err?)` methods
- [x] 1.2 Add optional `logger?: Logger` field to `CortexContext` in `packages/core/src/types.ts`
- [x] 1.3 Add `NoopLogger` implementation (all methods no-op) to `packages/core/src/observability.ts`
- [x] 1.4 Export `Logger` and `NoopLogger` from `packages/core/src/index.ts`
- [x] 1.5 Write unit tests for `NoopLogger` in `packages/core/src/observability.spec.ts`
- [x] 1.6 Run `bun test packages/core` — all pass
- [x] 1.7 Commit: `feat(core): add Logger port interface and NoopLogger`

## 2. Server — OTel logger factory

- [x] 2.1 Add `CORTEX_OTEL_ENABLED` (boolean, default `false`) to `packages/server/src/config.ts`; wire existing `logLevel` field into the schema comment
- [x] 2.2 Install OTel packages in `packages/server`: `bun add @opentelemetry/sdk-logs @opentelemetry/sdk-trace-node @opentelemetry/resources @opentelemetry/semantic-conventions`
- [x] 2.3 Create `packages/server/src/observability.ts` — exports `createLogger(logLevel, otelEnabled): Logger`
    - When `otelEnabled = false`: returns a plain `ConsoleLogger` (writes structured JSON to stderr, respects `logLevel`)
    - When `otelEnabled = true`: bootstraps `LoggerProvider` with `ConsoleLogRecordExporter` + `BatchLogRecordProcessor`, registers a `TracerProvider` with `ConsoleSpanExporter`, returns a `Logger` adapter backed by OTel `Logger`
- [x] 2.4 Write unit tests for `createLogger` in `packages/server/src/observability.spec.ts` — test both `otelEnabled` paths
- [x] 2.5 Update `createCortexContext()` in `packages/server/src/context.ts` to call `createLogger(config.logLevel, config.otelEnabled)` and assign to context
- [x] 2.6 Replace all `console.warn` / `console.error` calls in `packages/server/src/index.ts` with `logger.*` calls (logger is available from returned context or constructed before context in failure paths)
- [x] 2.7 Run `bun test packages/server` — all pass
- [x] 2.8 Commit: `feat(mcp): inject OTel logger into CortexContext and replace console calls`

## 3. Server — span-per-MCP-tool-call

- [x] 3.1 Create `packages/server/src/tracing.ts` — exports `withSpan(tracer, toolName, store, fn)` helper that starts a span, calls `fn()`, records `ok`/`error` attribute, ends span
- [x] 3.2 Wrap each memory tool handler (`add-memory.ts`, `get-memory.ts`, `list-memories.ts`, `update-memory.ts`, `remove-memory.ts`, `move-memory.ts`, `get-recent-memories.ts`, `prune-memories.ts`, `reindex-store.ts`) with `withSpan`
- [x] 3.3 Wrap category tools (`packages/server/src/category/tools.ts`) with `withSpan`
- [x] 3.4 Wrap store tools (`packages/server/src/store/tools.ts`) with `withSpan`
- [x] 3.5 Write unit tests for `withSpan` in `packages/server/src/tracing.spec.ts` — test ok path and error path
- [x] 3.6 Run `bun test packages/server` — all pass
- [x] 3.7 Commit: `feat(mcp): add per-tool OTel span instrumentation`

## 4. CLI — logger injection

- [x] 4.1 Create `packages/cli/src/observability.ts` — exports `createCliLogger(): Logger`
    - Plain `ConsoleLogger` writing to stderr; no OTel SDK dependency in CLI
    - Respects `DEBUG=cortex` env var to enable `debug` level
- [x] 4.2 Write unit tests for `createCliLogger` in `packages/cli/src/observability.spec.ts`
- [x] 4.3 Update `createCliCommandContext()` in `packages/cli/src/create-cli-command.ts` to call `createCliLogger()` and assign `logger` to context
- [x] 4.4 Replace bare `console.error` calls in `packages/cli/src/program.ts` with `logger.*` calls
- [x] 4.5 Run `bun test packages/cli` — all pass
- [x] 4.6 Commit: `feat(cli): inject console logger into CortexContext and replace console calls`

## 5. Integration smoke test

- [x] 5.1 Run `bun run build` — no TypeScript errors
- [x] 5.2 Start server with `CORTEX_OTEL_ENABLED=true CORTEX_LOG_LEVEL=debug` and call a few MCP tools; verify OTel spans and logs appear on stdout/stderr
- [x] 5.3 Run full test suite `bun test packages` — all pass (1156 pass, 0 fail)
- [x] 5.4 Commit: all phases committed and reviewed
