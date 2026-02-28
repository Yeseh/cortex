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
 * When `tracer` is null (CORTEX_OTEL_ENABLED=false), calls `fn()` directly.
 * When `tracer` is set, creates a named span, records the result status,
 * and exports via the configured SpanExporter.
 *
 * @param tracer - Active OTel Tracer, or null when OTel is disabled
 * @param toolName - MCP tool name used as span name and `rpc.method` attribute
 * @param store - Memory store name recorded as `cortex.store` attribute
 * @param fn - Async handler to wrap
 * @returns The handler's return value
 *
 * @example
 * ```typescript
 * // With OTel enabled:
 * return withSpan(tracer, 'cortex_add_memory', input.store, async () => {
 *     // ... handler body ...
 * });
 *
 * // With OTel disabled (tracer=null), behaves identically but with zero overhead:
 * return withSpan(null, 'cortex_add_memory', input.store, async () => {
 *     // ... handler body ...
 * });
 * ```
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
