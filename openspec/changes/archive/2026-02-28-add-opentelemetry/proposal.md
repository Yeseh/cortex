# Change: Add OpenTelemetry observability (console exporter, first pass)

## Why

The codebase has zero structured observability — only raw `console.warn`/`console.error` calls in two entrypoints, and a `logLevel` config field that is parsed but never wired up. Adding OpenTelemetry as the observability foundation enables structured logs and traces that can later be routed to any backend (OTLP, Jaeger, Datadog) without changing application code.

## What Changes

- **ADDED** `Logger` port interface in `packages/core/src/types.ts` — defines `debug`, `info`, `warn`, `error` methods; optional on `CortexContext`
- **ADDED** `observability` capability spec covering the `Logger` port, `NoopLogger`, and console/OTel implementations
- **MODIFIED** `CortexContext` — adds optional `logger?: Logger` field (non-breaking; all existing consumers continue to work without changes)
- **ADDED** OTel logger factory in `packages/server/src/` — wires `@opentelemetry/sdk-logs` + `ConsoleLogRecordExporter` using `logLevel` from `ServerConfig`
- **MODIFIED** `createCortexContext()` (server) — constructs OTel logger and injects it into context
- **ADDED** OTel logger factory in `packages/cli/src/` — simpler console-only logger (CLI is interactive; structured logs go to stderr)
- **MODIFIED** `createCliCommandContext()` (CLI) — constructs logger and injects into context
- **MODIFIED** MCP server `index.ts` — replaces bare `console.*` calls with `ctx.logger.*` calls
- **MODIFIED** CLI `program.ts` — replaces bare `console.error` calls with logger calls
- **ADDED** Span-per-tool-call instrumentation in MCP tool handlers using `@opentelemetry/sdk-trace-node` + `ConsoleSpanExporter`
- **ADDED** `CORTEX_OTEL_ENABLED` env var (default `false`) — lets users opt in to full OTel SDK; when disabled, a lightweight `ConsoleLogger` (no OTel dep) is used instead

## Impact

- Affected specs: `mcp-server-core` (environment config), new `observability` capability
- Affected code:
    - `packages/core/src/types.ts` — `CortexContext`, `Logger` interface
    - `packages/core/src/index.ts` — barrel export of `Logger`
    - `packages/server/src/config.ts` — wire `logLevel`; add `CORTEX_OTEL_ENABLED`
    - `packages/server/src/context.ts` — inject logger
    - `packages/server/src/index.ts` — replace console calls
    - `packages/server/src/memory/tools/*.ts` — span-per-call wrappers
    - `packages/server/src/category/tools.ts` — span-per-call wrappers
    - `packages/server/src/store/tools.ts` — span-per-call wrappers
    - `packages/cli/src/create-cli-command.ts` — inject logger
    - `packages/cli/src/program.ts` — replace console calls
- No breaking changes — `logger` is optional on `CortexContext`; existing tests need no updates
