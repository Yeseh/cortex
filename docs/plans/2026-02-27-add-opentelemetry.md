# OpenTelemetry First Pass — Implementation Plan

**Goal:** Add a `Logger` port to `CortexContext`, implement a console-based OTel logger+tracer in the MCP server and a plain console logger in the CLI, replacing all bare `console.*` calls.
**Architecture:** Logger port defined in core (no OTel dep); OTel SDK only in `packages/server`; CLI uses a zero-dep `ConsoleLogger`. Full OTel stack is opt-in via `CORTEX_OTEL_ENABLED=true`. Spans wrap each MCP tool call via a `withSpan` helper.
**Tech Stack:** `@opentelemetry/sdk-logs`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/resources`, `@opentelemetry/semantic-conventions` (server only); plain JSON-to-stderr for CLI.
**Session Id:** ses_35f4d9eedffew25wQnfIC1LPzS

---

## Background & Constraints

- **7 real `console.*` calls** total across two files: `packages/server/src/index.ts` (5 warn, 2 error) and `packages/cli/src/program.ts` (2 error).
- `packages/server/src/config.ts` already parses `CORTEX_LOG_LEVEL` from env but the value is never used. Wire it up here.
- **No OTel dep in `core` or `storage-fs` or `cli`** — port interface only. OTel SDK stays in `packages/server`.
- `bun build --compile` bundles all deps. OTel console exporters are pure-TS, no native bindings.
- Bun supports `AsyncLocalStorage` (needed for span context propagation across async calls).
- All tests must stay green. `logger` is optional on `CortexContext` so no existing test needs updating.

---

## Step 1 — Core: Logger port (packages/core)

**Files to touch:** `packages/core/src/types.ts`, new `packages/core/src/observability.ts`, `packages/core/src/index.ts`

### 1.1 Add `Logger` interface to `packages/core/src/types.ts`

Add below the `CortexContext` interface:

```typescript
/**
 * Minimal structured logger port.
 * Implementations are provided by entrypoints (server, CLI).
 * Core and handler code MUST NOT import any logging library directly.
 *
 * @module core/types
 */
export interface Logger {
    debug(msg: string, attrs?: Record<string, unknown>): void;
    info(msg: string, attrs?: Record<string, unknown>): void;
    warn(msg: string, attrs?: Record<string, unknown>): void;
    error(msg: string, err?: unknown, attrs?: Record<string, unknown>): void;
}
```

Add `logger?: Logger` to `CortexContext`:

```typescript
export interface CortexContext {
    // ... existing fields ...
    logger?: Logger;
}
```

### 1.2 Create `packages/core/src/observability.ts`

````typescript
/**
 * Core observability utilities.
 * @module core/observability
 */
import type { Logger } from './types.ts';

/**
 * A Logger implementation that silently discards all output.
 * Use as the default in tests or contexts where logging is unwanted.
 *
 * @example
 * ```typescript
 * const ctx: CortexContext = { ..., logger: new NoopLogger() };
 * ctx.logger?.info('this does nothing');
 * ```
 */
export class NoopLogger implements Logger {
    debug(_msg: string, _attrs?: Record<string, unknown>): void {}
    info(_msg: string, _attrs?: Record<string, unknown>): void {}
    warn(_msg: string, _attrs?: Record<string, unknown>): void {}
    error(_msg: string, _err?: unknown, _attrs?: Record<string, unknown>): void {}
}
````

### 1.3 Write colocated test `packages/core/src/observability.spec.ts`

```typescript
import { describe, it, expect, spyOn } from 'bun:test';
import { NoopLogger } from './observability.ts';

describe('NoopLogger', () => {
    it('should not write to stdout on debug', () => {
        const spy = spyOn(process.stdout, 'write');
        new NoopLogger().debug('test');
        expect(spy).not.toHaveBeenCalled();
    });
    // similar tests for info, warn, error
});
```

### 1.4 Export from `packages/core/src/index.ts`

```typescript
export { NoopLogger } from './observability.ts';
export type { Logger } from './types.ts'; // Logger is already re-exported via types
```

### 1.5 Run tests and commit

```bash
bun test packages/core
# all pass
git add -p && git commit -m "feat(core): add Logger port interface and NoopLogger"
```

---

## Step 2 — Server: `CORTEX_OTEL_ENABLED` config (packages/server)

**File:** `packages/server/src/config.ts`

The existing `logLevel` field is already in the schema — just needs a comment fix and `otelEnabled` added:

```typescript
// In the Zod schema:
otelEnabled: z.boolean().default(false),
// env var: CORTEX_OTEL_ENABLED

logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
// env var: CORTEX_LOG_LEVEL  (was already there, now actually used)
```

In the `parseConfig` function, map `CORTEX_OTEL_ENABLED` to the boolean:

```typescript
otelEnabled: process.env.CORTEX_OTEL_ENABLED === 'true',
```

No test changes needed — config unit tests already cover env var mapping.

---

## Step 3 — Server: Install OTel packages

```bash
bun add --cwd packages/server \
  @opentelemetry/sdk-logs \
  @opentelemetry/sdk-trace-node \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/api \
  @opentelemetry/api-logs
```

> **Why `@opentelemetry/api` separately?** The API package is what handler code imports for `context.active()` / tracer lookup; the SDK packages provide the implementation. Keeping them separate allows future upgrades of just the SDK without touching handler code.

---

## Step 4 — Server: `createLogger` factory (packages/server/src/observability.ts)

New file `packages/server/src/observability.ts`:

```typescript
import type { Logger } from '@yeseh/cortex-core';

// --- Plain ConsoleLogger (otelEnabled = false) ---

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LEVELS;

export class ConsoleLogger implements Logger {
    private minLevel: number;
    constructor(level: LogLevel = 'info') {
        this.minLevel = LEVELS[level];
    }
    private write(
        level: string,
        msg: string,
        attrs?: Record<string, unknown>,
        err?: unknown
    ): void {
        if (LEVELS[level as LogLevel] < this.minLevel) return;
        const line: Record<string, unknown> = { ts: new Date().toISOString(), level, msg };
        if (attrs) Object.assign(line, attrs);
        if (err instanceof Error) line['error'] = err.message;
        process.stderr.write(JSON.stringify(line) + '\n');
    }
    debug(msg: string, attrs?: Record<string, unknown>) {
        this.write('debug', msg, attrs);
    }
    info(msg: string, attrs?: Record<string, unknown>) {
        this.write('info', msg, attrs);
    }
    warn(msg: string, attrs?: Record<string, unknown>) {
        this.write('warn', msg, attrs);
    }
    error(msg: string, err?: unknown, attrs?: Record<string, unknown>) {
        this.write('error', msg, attrs, err);
    }
}

// --- OTel logger (otelEnabled = true) ---
// Lazy import so OTel SDK is only loaded when actually needed.

async function createOtelLogger(level: LogLevel): Promise<Logger> {
    const { LoggerProvider, BatchLogRecordProcessor } = await import('@opentelemetry/sdk-logs');
    const { ConsoleLogRecordExporter } = await import('@opentelemetry/sdk-logs');
    const { Resource } = await import('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME } = await import('@opentelemetry/semantic-conventions');

    const resource = new Resource({ [ATTR_SERVICE_NAME]: 'cortex-mcp' });
    const provider = new LoggerProvider({ resource });
    provider.addLogRecordProcessor(new BatchLogRecordProcessor(new ConsoleLogRecordExporter()));

    const otelLogger = provider.getLogger('cortex-mcp');
    // Wrap in Logger interface
    return new OtelLoggerAdapter(otelLogger, level);
}

// OtelLoggerAdapter wraps the OTel Logger API into the core Logger port.
// (implementation detail — not exported)

// --- Public factory ---
export async function createLogger(level: LogLevel, otelEnabled: boolean): Promise<Logger> {
    if (otelEnabled) return createOtelLogger(level);
    return new ConsoleLogger(level);
}
```

> **Note:** The lazy `await import(...)` pattern avoids loading OTel SDK on startup when disabled. It costs one dynamic import on first logger creation when enabled.

Write colocated test `packages/server/src/observability.spec.ts`:

- Test `ConsoleLogger` writes JSON to stderr at correct levels
- Test `ConsoleLogger` suppresses messages below `minLevel`
- Test `createLogger(level, false)` returns `ConsoleLogger`
- Test `createLogger(level, true)` returns an object satisfying `Logger` interface (mock the OTel import or use a real instance)

---

## Step 5 — Server: Inject logger into `createCortexContext`

**File:** `packages/server/src/context.ts`

```typescript
import { createLogger } from './observability.ts';

export async function createCortexContext(config: ServerConfig): Promise<Result<CortexContext, ...>> {
    const logger = await createLogger(config.logLevel, config.otelEnabled);
    // ... existing context construction ...
    return ok({ cortex, config: configAdapter, settings, stores, now: () => new Date(), stdin: process.stdin, stdout: process.stdout, globalDataPath: config.dataPath, logger });
}
```

---

## Step 6 — Server: Replace `console.*` in `index.ts`

**File:** `packages/server/src/index.ts`

The 7 calls become:

```typescript
// Before:
console.warn(`Cortex MCP server listening on http://${config.host}:${config.port}`);
// After:
logger.info(`Cortex MCP server listening`, { host: config.host, port: config.port });
```

For the failure paths before context exists, construct a fallback `ConsoleLogger` directly:

```typescript
import { ConsoleLogger } from './observability.ts';
const fallbackLogger = new ConsoleLogger('warn');

// In error paths before ctx is available:
fallbackLogger.error('Failed to start server', result.error);
```

Run `bun test packages/server` — all pass.

Commit: `feat(mcp): inject OTel logger into CortexContext and replace console calls`

---

## Step 7 — Server: `withSpan` helper and tool instrumentation

**New file:** `packages/server/src/tracing.ts`

```typescript
import type { Tracer } from '@opentelemetry/api';
import type { Result } from '@yeseh/cortex-core';

/**
 * Wraps a tool handler in an OTel span.
 * Noop-safe: if tracer is undefined, fn() is called directly.
 */
export async function withSpan<T>(
    tracer: Tracer | undefined,
    toolName: string,
    storeName: string,
    fn: () => Promise<T>
): Promise<T> {
    if (!tracer) return fn();
    const span = tracer.startSpan(toolName, {
        attributes: { 'rpc.method': toolName, 'cortex.store': storeName },
    });
    try {
        const result = await fn();
        const r = result as Result<unknown, unknown>;
        if (r && typeof r === 'object' && 'ok' in r) {
            span.setAttribute('error', !r.ok);
            if (!r.ok && typeof (r as any).error === 'object') {
                span.setAttribute('error.type', String((r as any).error.code ?? 'unknown'));
            }
        }
        return result;
    } catch (err) {
        span.setAttribute('error', true);
        throw err;
    } finally {
        span.end();
    }
}
```

**In `createCortexContext` (or a new `createTracer` helper):**
When `otelEnabled = true`, bootstrap a `TracerProvider` with `ConsoleSpanExporter` and store the `Tracer` on context (or thread it through the `withSpan` calls in tool handlers).

> **Design choice:** Rather than adding `tracer` to `CortexContext` (which would expand the port and affect all consumers), keep the tracer as an internal dependency of the server's tool registration layer. Pass it down from `createServer()` into `registerMemoryTools(server, ctx, tracer?)`.

**In each tool handler** (e.g., `packages/server/src/memory/tools/add-memory.ts`):

```typescript
// Before:
server.tool('cortex_add_memory', ..., async (input) => {
    const parsed = parseInput(schema, input);
    return handler(ctx, parsed);
});

// After:
server.tool('cortex_add_memory', ..., async (input) => {
    return withSpan(tracer, 'cortex_add_memory', input.store ?? ctx.settings.defaultStore, async () => {
        const parsed = parseInput(schema, input);
        return handler(ctx, parsed);
    });
});
```

Write `packages/server/src/tracing.spec.ts`:

- Test `withSpan` with `tracer = undefined` calls fn and returns result
- Test `withSpan` with a real/mock Tracer creates and ends span
- Test `withSpan` sets `error = false` on ok result
- Test `withSpan` sets `error = true` and `error.type` on error result

Run `bun test packages/server` — all pass.

Commit: `feat(mcp): add per-tool OTel span instrumentation`

---

## Step 8 — CLI: Logger injection (packages/cli)

**New file:** `packages/cli/src/observability.ts`

```typescript
import type { Logger } from '@yeseh/cortex-core';

/**
 * Creates a logger for CLI use.
 * - Writes structured JSON lines to stderr (never stdout — that's for command output)
 * - Debug level enabled when DEBUG=cortex env var is set
 * - No OTel SDK dependency; keeps the CLI binary lean
 */
export function createCliLogger(): Logger {
    const debugEnabled = (process.env.DEBUG ?? '').split(',').includes('cortex');
    return {
        debug(msg, attrs) {
            if (!debugEnabled) return;
            process.stderr.write(
                JSON.stringify({ ts: new Date().toISOString(), level: 'debug', msg, ...attrs }) +
                    '\n'
            );
        },
        info(msg, attrs) {
            process.stderr.write(
                JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg, ...attrs }) +
                    '\n'
            );
        },
        warn(msg, attrs) {
            process.stderr.write(
                JSON.stringify({ ts: new Date().toISOString(), level: 'warn', msg, ...attrs }) +
                    '\n'
            );
        },
        error(msg, err, attrs) {
            const line: Record<string, unknown> = {
                ts: new Date().toISOString(),
                level: 'error',
                msg,
                ...attrs,
            };
            if (err instanceof Error) line['error'] = err.message;
            process.stderr.write(JSON.stringify(line) + '\n');
        },
    };
}
```

**Update `packages/cli/src/create-cli-command.ts`:**

```typescript
import { createCliLogger } from './observability.ts';

// In createCliCommandContext():
const logger = createCliLogger();
return ok({
    cortex,
    config: configAdapter,
    settings,
    stores,
    now: () => new Date(),
    stdin: process.stdin,
    stdout: process.stdout,
    logger,
});
```

**Update `packages/cli/src/program.ts`:**

The 2 bare `console.error` calls in the `runProgram()` catch block are in a scope before any `CortexContext` exists. Construct a logger directly:

```typescript
import { createCliLogger } from './observability.ts';

// In the catch block:
const logger = createCliLogger();
logger.error('Unexpected error', error);
```

Write `packages/cli/src/observability.spec.ts`:

- Test debug is suppressed when `DEBUG` unset
- Test debug emits to stderr when `DEBUG=cortex`
- Test warn always emits to stderr
- Test error includes error.message when Error passed

Run `bun test packages/cli` — all pass.

Commit: `feat(cli): inject console logger into CortexContext and replace console calls`

---

## Step 9 — Full integration smoke test

```bash
# Build
bun run build

# Run server with full OTel
CORTEX_OTEL_ENABLED=true CORTEX_LOG_LEVEL=debug bun run packages/server/src/index.ts &

# Hit health endpoint — should see log record and span on stdout
curl http://localhost:3000/health

# Run full test suite
bun test packages
```

Expected console output (OTel enabled):

```
{
  "Name": "cortex_add_memory",
  "SpanContext": { "traceId": "...", "spanId": "..." },
  "Attributes": { "rpc.method": "cortex_add_memory", "cortex.store": "default", "error": false }
}
```

---

## File Change Summary

| File                                        | Change                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `packages/core/src/types.ts`                | Add `Logger` interface, add `logger?: Logger` to `CortexContext` |
| `packages/core/src/observability.ts`        | New — `NoopLogger`                                               |
| `packages/core/src/observability.spec.ts`   | New — `NoopLogger` tests                                         |
| `packages/core/src/index.ts`                | Export `Logger`, `NoopLogger`                                    |
| `packages/server/src/config.ts`             | Add `otelEnabled` field, wire `logLevel`                         |
| `packages/server/src/observability.ts`      | New — `ConsoleLogger`, `createLogger`                            |
| `packages/server/src/observability.spec.ts` | New — logger tests                                               |
| `packages/server/src/tracing.ts`            | New — `withSpan` helper                                          |
| `packages/server/src/tracing.spec.ts`       | New — `withSpan` tests                                           |
| `packages/server/src/context.ts`            | Inject logger                                                    |
| `packages/server/src/index.ts`              | Replace 7 console calls with logger calls                        |
| `packages/server/src/memory/tools/*.ts`     | Wrap handlers with `withSpan` (9 files)                          |
| `packages/server/src/category/tools.ts`     | Wrap handlers with `withSpan`                                    |
| `packages/server/src/store/tools.ts`        | Wrap handlers with `withSpan`                                    |
| `packages/cli/src/observability.ts`         | New — `createCliLogger`                                          |
| `packages/cli/src/observability.spec.ts`    | New — CLI logger tests                                           |
| `packages/cli/src/create-cli-command.ts`    | Inject logger                                                    |
| `packages/cli/src/program.ts`               | Replace 2 console calls with logger                              |

## Key Testing Notes

- **Do NOT** mock `process.stderr` globally — use `spyOn(process.stderr, 'write')` per test, restore in `afterEach`.
- `NoopLogger` tests verify no stdout/stderr side effects.
- `ConsoleLogger` tests check the JSON shape of output lines.
- `withSpan` tests use a real `@opentelemetry/sdk-trace-node` tracer with an in-memory exporter (not console) to avoid stdout noise in test output.
- For `createLogger(level, true)`, assert the returned object satisfies the `Logger` interface shape; don't assert OTel internals.
- All 12 pre-existing MCP integration test failures (see `todo/fix-mcp-integration-test-failures`) should remain unchanged — do not fix them in this PR.
