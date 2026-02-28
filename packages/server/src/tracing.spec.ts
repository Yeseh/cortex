import { describe, it, expect, mock } from 'bun:test';
import { withSpan } from './tracing.ts';
import type { Tracer, Span } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';

/** Creates a mock Span with jest-compatible mock functions */
const createMockSpan = (): Span & {
    setAttribute: ReturnType<typeof mock>;
    setStatus: ReturnType<typeof mock>;
    recordException: ReturnType<typeof mock>;
    end: ReturnType<typeof mock>;
} => ({
    setAttribute: mock(() => {}),
    setStatus: mock(() => {}),
    recordException: mock(() => {}),
    end: mock(() => {}),
    // Minimal Span interface stubs
    spanContext: () => ({ traceId: 'test', spanId: 'test', traceFlags: 1 }),
    addEvent: mock(() => {}),
    addLink: mock(() => {}),
    addLinks: mock(() => {}),
    updateName: mock(() => {}),
    isRecording: () => true,
} as any);

/** Creates a mock Tracer that synchronously calls the span callback */
const createMockTracer = (span: ReturnType<typeof createMockSpan>): Tracer => ({
    startSpan: mock(() => span),
    startActiveSpan: mock((_name: string, fn: (span: any) => any) => fn(span)),
} as any);

describe('withSpan', () => {
    describe('when tracer is null (OTel disabled)', () => {
        it('should call fn() directly without creating a span', async () => {
            const fn = mock(async () => 'result');
            const result = await withSpan(null, 'cortex_add_memory', 'default', fn);
            expect(result).toBe('result');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should propagate errors from fn() without wrapping', async () => {
            const error = new Error('handler failed');
            const fn = mock(async () => { throw error; });
            await expect(withSpan(null, 'cortex_add_memory', 'default', fn)).rejects.toThrow('handler failed');
        });
    });

    describe('when tracer is set (OTel enabled)', () => {
        it('should start a span with the tool name', async () => {
            const span = createMockSpan();
            const tracer = createMockTracer(span);
            await withSpan(tracer, 'cortex_add_memory', 'default', async () => 'ok');
            expect(tracer.startActiveSpan).toHaveBeenCalledWith('cortex_add_memory', expect.any(Function));
        });

        it('should set rpc.method and cortex.store attributes on success', async () => {
            const span = createMockSpan();
            const tracer = createMockTracer(span);
            await withSpan(tracer, 'cortex_get_memory', 'mystore', async () => 'ok');
            expect(span.setAttribute).toHaveBeenCalledWith('rpc.method', 'cortex_get_memory');
            expect(span.setAttribute).toHaveBeenCalledWith('cortex.store', 'mystore');
            expect(span.setAttribute).toHaveBeenCalledWith('error', false);
        });

        it('should set span status to OK on success', async () => {
            const span = createMockSpan();
            const tracer = createMockTracer(span);
            await withSpan(tracer, 'cortex_get_memory', 'default', async () => 'ok');
            expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
        });

        it('should end the span after successful completion', async () => {
            const span = createMockSpan();
            const tracer = createMockTracer(span);
            await withSpan(tracer, 'cortex_get_memory', 'default', async () => 'ok');
            expect(span.end).toHaveBeenCalledTimes(1);
        });

        it('should set error=true and recordException on failure', async () => {
            const span = createMockSpan();
            const tracer = createMockTracer(span);
            const error = new Error('something broke');
            await expect(
                withSpan(tracer, 'cortex_add_memory', 'default', async () => { throw error; })
            ).rejects.toThrow('something broke');
            expect(span.setAttribute).toHaveBeenCalledWith('error', true);
            expect(span.recordException).toHaveBeenCalledWith(error);
            expect(span.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
        });

        it('should still end the span even when fn() throws', async () => {
            const span = createMockSpan();
            const tracer = createMockTracer(span);
            await expect(
                withSpan(tracer, 'cortex_add_memory', 'default', async () => { throw new Error('fail'); })
            ).rejects.toThrow();
            expect(span.end).toHaveBeenCalledTimes(1);
        });

        it('should set error.type attribute when error is an Error instance', async () => {
            class CustomError extends Error { constructor() { super('custom'); } }
            const span = createMockSpan();
            const tracer = createMockTracer(span);
            await expect(
                withSpan(tracer, 'cortex_add_memory', 'default', async () => { throw new CustomError(); })
            ).rejects.toThrow();
            expect(span.setAttribute).toHaveBeenCalledWith('error.type', 'CustomError');
        });

        it('should return the value from fn() on success', async () => {
            const span = createMockSpan();
            const tracer = createMockTracer(span);
            const result = await withSpan(tracer, 'cortex_add_memory', 'default', async () => ({ text: 'created' }));
            expect(result).toEqual({ text: 'created' });
        });
    });
});
