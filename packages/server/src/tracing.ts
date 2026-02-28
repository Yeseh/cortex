/**
 * OTel span-per-MCP-tool-call helper.
 *
 * Wraps MCP tool handler invocations in an OpenTelemetry span when a tracer
 * is provided. When the tracer is null (OTel disabled), the function is called
 * directly with no overhead.
 *
 * @module server/tracing
 */
import { SpanStatusCode, type Tracer } from '@opentelemetry/api';

/**
 * Wraps an async MCP tool handler in an OTel span.
 *
 * **Zero-overhead passthrough:** When `tracer` is `null` (i.e. `CORTEX_OTEL_ENABLED=false`),
 * `fn()` is called directly with no span creation, attribute recording, or SDK overhead.
 *
 * **When `tracer` is non-null:** creates an active span named after `toolName`, then:
 * - Sets `rpc.method` attribute to `toolName`
 * - Sets `cortex.store` attribute to `store`
 * - On success: sets `error=false` and span status `OK`
 * - On throw: sets `error=true`, records `error.type` (the constructor name of the thrown
 *   `Error`), calls `span.recordException(err)` for full stack capture, sets span status
 *   `ERROR`, then re-throws so the caller's error handling is unaffected
 * - Always ends the span in the `finally` block
 *
 * @param tracer - Active OTel `Tracer`, or `null` when OTel is disabled
 * @param toolName - MCP tool name used as the span name and `rpc.method` attribute
 * @param store - Memory store name recorded as the `cortex.store` span attribute
 * @param fn - Async handler to wrap; its return value is passed through unchanged
 * @returns A `Promise` resolving to the handler's return value
 * @throws Re-throws any error thrown by `fn` after recording it on the span
 *
 * @example
 * ```typescript
 * // OTel enabled — creates a span named 'cortex_add_memory':
 * return withSpan(tracer, 'cortex_add_memory', input.store, async () => {
 *     return handler(ctx, input);
 * });
 *
 * // OTel disabled — zero overhead, identical behaviour:
 * return withSpan(null, 'cortex_add_memory', input.store, async () => {
 *     return handler(ctx, input);
 * });
 * ```
 *
 * @see {@link tracer} exported from `server/observability` for the tracer instance
 */
export const withSpan = async <T>(
    tracer: Tracer | null,
    toolName: string,
    store: string,
    fn: () => Promise<T>,
): Promise<T> => {
    if (!tracer) return fn();

    return tracer.startActiveSpan(toolName, async (span) => {
        try {
            span.setAttribute('rpc.method', toolName);
            span.setAttribute('cortex.store', store);
            const result = await fn();
            span.setAttribute('error', false);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (err) {
            span.setAttribute('error', true);
            if (err instanceof Error) {
                span.setAttribute('error.type', err.constructor.name);
                span.recordException(err);
            }
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw err;
        } finally {
            span.end();
        }
    });
};
