/**
 * Server observability — OTel logger factory and tracer instance.
 *
 * When CORTEX_OTEL_ENABLED=false (default), returns a plain ConsoleLogger that
 * writes structured JSON lines to stderr. No OTel SDK bootstrapped.
 *
 * When CORTEX_OTEL_ENABLED=true, bootstraps:
 * - LoggerProvider with ConsoleLogRecordExporter
 * - TracerProvider with ConsoleSpanExporter
 * Both write to stdout via their built-in Console exporters.
 *
 * @module server/observability
 */
import type { Logger } from '@yeseh/cortex-core';
import type { LogLevel } from './config.ts';
import { LoggerProvider, BatchLogRecordProcessor, ConsoleLogRecordExporter } from '@opentelemetry/sdk-logs';
import { NodeTracerProvider, ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { SeverityNumber, logs, type AnyValueMap } from '@opentelemetry/api-logs';
import { type Tracer } from '@opentelemetry/api';

/** Numeric priority rank for each log level, used to filter below-threshold messages. */
const LOG_LEVEL_RANK: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Lightweight console logger writing structured JSON to stderr.
 *
 * Used when `CORTEX_OTEL_ENABLED=false` (the default). Has no OTel dependency,
 * keeping startup fast and the import graph minimal. Each log line is a single
 * JSON object terminated with a newline, making it easy to pipe to `jq` or any
 * structured-log aggregator.
 *
 * Log lines have the shape:
 * `{"ts":"<ISO-8601>","level":"<level>","msg":"<message>",...meta}`
 *
 * Messages below the configured `level` threshold are silently dropped.
 *
 * @example
 * ```typescript
 * const logger = new ConsoleLogger('info');
 * logger.debug('skipped');        // dropped — below threshold
 * logger.info('server started');  // written to stderr
 * logger.error('oops', new Error('boom'));
 * // {"ts":"…","level":"error","msg":"oops","error":"boom","stack":"Error: boom\n…"}
 * ```
 */
class ConsoleLogger implements Logger {
    /**
     * @param level - Minimum log level to emit. Messages below this level are dropped.
     */
    constructor(private readonly level: LogLevel) {}

    /**
     * Returns `true` when the given `level` meets or exceeds the configured minimum threshold.
     *
     * @param level - Level of the candidate log message
     */
    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[this.level];
    }

    /**
     * Serialises a log entry as a single JSON line and writes it to `stderr`.
     *
     * @param level - Severity label written into the JSON `level` field
     * @param msg - Human-readable message written into the JSON `msg` field
     * @param meta - Optional extra fields merged into the top-level JSON object
     */
    private write(level: string, msg: string, meta?: Record<string, unknown>): void {
        process.stderr.write(
            JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta }) + '\n',
        );
    }

    /**
     * Logs a debug-level message. Dropped unless the configured threshold is `'debug'`.
     *
     * @param msg - Verbose diagnostic message
     * @param meta - Optional structured metadata to merge into the log line
     */
    debug(msg: string, meta?: Record<string, unknown>): void {
        if (this.shouldLog('debug')) this.write('debug', msg, meta);
    }

    /**
     * Logs an info-level message. Emitted for general operational events.
     *
     * @param msg - Informational message
     * @param meta - Optional structured metadata to merge into the log line
     */
    info(msg: string, meta?: Record<string, unknown>): void {
        if (this.shouldLog('info')) this.write('info', msg, meta);
    }

    /**
     * Logs a warning-level message. Emitted for recoverable anomalies that warrant attention.
     *
     * @param msg - Warning message
     * @param meta - Optional structured metadata to merge into the log line
     */
    warn(msg: string, meta?: Record<string, unknown>): void {
        if (this.shouldLog('warn')) this.write('warn', msg, meta);
    }

    /**
     * Logs an error-level message, optionally with error details extracted from `err`.
     *
     * When `err` is an `Error` instance, `error` (message) and `stack` fields are added
     * to the log line. When `err` is some other non-nullish value, it is coerced to a
     * string and recorded under `error`.
     *
     * @param msg - Human-readable description of the failure
     * @param err - Optional Error object or arbitrary thrown value
     * @param meta - Optional structured metadata to merge into the log line
     */
    error(msg: string, err?: Error | unknown, meta?: Record<string, unknown>): void {
        if (this.shouldLog('error')) {
            const errMeta =
                err instanceof Error
                    ? { error: err.message, stack: err.stack }
                    : err !== null && err !== undefined
                        ? { error: String(err) }
                        : {};
            this.write('error', msg, { ...meta, ...errMeta });
        }
    }
}

/**
 * Maps a Cortex `LogLevel` string to the corresponding OTel `SeverityNumber`.
 *
 * Falls back to `SeverityNumber.INFO` for any unrecognised level value so that
 * new level strings added in future do not silently produce invalid severity data.
 *
 * @param level - Cortex log level string (`'debug'` | `'info'` | `'warn'` | `'error'`)
 * @returns The matching OTel `SeverityNumber` constant
 *
 * @example
 * ```typescript
 * logLevelToSeverity('error'); // → SeverityNumber.ERROR (17)
 * logLevelToSeverity('debug'); // → SeverityNumber.DEBUG  (5)
 * ```
 */
function logLevelToSeverity(level: LogLevel): number {
    switch (level) {
        case 'debug':
            return SeverityNumber.DEBUG;
        case 'info':
            return SeverityNumber.INFO;
        case 'warn':
            return SeverityNumber.WARN;
        case 'error':
            return SeverityNumber.ERROR;
        default:
            return SeverityNumber.INFO;
    }
}

/**
 * Guards against re-registering OTel providers within a single process.
 *
 * Set to `true` on the first `createLogger(…, true)` call, preventing duplicate
 * provider registration if the factory is called multiple times (e.g., in tests).
 * Reset to `false` by `shutdown()` to allow clean re-initialisation.
 */
let bootstrapped = false;

/** Active `NodeTracerProvider` instance when OTel is enabled; `null` otherwise. */
let _tracerProvider: NodeTracerProvider | null = null;

/** Active `LoggerProvider` instance when OTel is enabled; `null` otherwise. */
let _loggerProvider: LoggerProvider | null = null;

/**
 * Module-level tracer — set when OTel is enabled, `null` otherwise.
 *
 * Imported by `tracing.ts` for span-per-tool-call instrumentation. Callers
 * must treat `null` as "OTel disabled" and fall back to direct invocation.
 *
 * @see {@link withSpan} in `server/tracing` for the consumer pattern
 */
export let tracer: Tracer | null = null;

/**
 * Creates a logger for the MCP server, optionally bootstrapping the OTel SDK.
 *
 * **When `otelEnabled` is `false`** (the default): returns a `ConsoleLogger` that
 * writes structured JSON lines to `stderr`. No OTel SDK code is executed; the
 * `tracer` export remains `null`.
 *
 * **When `otelEnabled` is `true`**: on the first call, bootstraps a
 * `NodeTracerProvider` (with `BatchSpanProcessor` → `ConsoleSpanExporter`) and a
 * `LoggerProvider` (with `BatchLogRecordProcessor` → `ConsoleLogRecordExporter`),
 * then sets the module-level `tracer`. Subsequent calls with `otelEnabled=true`
 * reuse the already-bootstrapped providers (guarded by `bootstrapped`).
 *
 * Call `shutdown()` before process exit to flush any buffered spans and log records.
 *
 * @param logLevel - Minimum log level to emit. Messages below this level are dropped.
 * @param otelEnabled - When `true`, bootstrap the OTel SDK and return an OTel-backed logger.
 * @returns A `Logger` implementation appropriate for the selected mode.
 *
 * @example
 * ```typescript
 * // Plain ConsoleLogger writing to stderr (OTel disabled):
 * const logger = createLogger('info', false);
 *
 * // OTel-backed logger writing to stdout via ConsoleExporters:
 * const otelLogger = createLogger('debug', true);
 *
 * // On shutdown, flush buffered telemetry:
 * await shutdown();
 * ```
 *
 * @see {@link shutdown} to flush and tear down OTel providers
 */
export const createLogger = (logLevel: LogLevel, otelEnabled: boolean): Logger => {
    if (!otelEnabled) {
        return new ConsoleLogger(logLevel);
    }

    if (!bootstrapped) {
        bootstrapped = true;
        const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'cortex-memory' });

        // Bootstrap TracerProvider — processors go in constructor config (OTel SDK v2)
        _tracerProvider = new NodeTracerProvider({
            resource,
            spanProcessors: [new BatchSpanProcessor(new ConsoleSpanExporter())],
        });
        _tracerProvider.register();
        tracer = _tracerProvider.getTracer('cortex-memory');

        // Bootstrap LoggerProvider — processors go in constructor config (OTel SDK v2)
        _loggerProvider = new LoggerProvider({
            resource,
            processors: [new BatchLogRecordProcessor(new ConsoleLogRecordExporter())],
        });
        logs.setGlobalLoggerProvider(_loggerProvider);
    }

    const otelLogger = logs.getLogger('cortex-memory');
    const minSeverity = logLevelToSeverity(logLevel);

    return {
        debug(msg: string, meta?: Record<string, unknown>): void {
            if (logLevelToSeverity('debug') >= minSeverity) {
                otelLogger.emit({
                    severityNumber: SeverityNumber.DEBUG,
                    body: msg,
                    attributes: meta as AnyValueMap | undefined,
                });
            }
        },
        info(msg: string, meta?: Record<string, unknown>): void {
            if (logLevelToSeverity('info') >= minSeverity) {
                otelLogger.emit({
                    severityNumber: SeverityNumber.INFO,
                    body: msg,
                    attributes: meta as AnyValueMap | undefined,
                });
            }
        },
        warn(msg: string, meta?: Record<string, unknown>): void {
            if (logLevelToSeverity('warn') >= minSeverity) {
                otelLogger.emit({
                    severityNumber: SeverityNumber.WARN,
                    body: msg,
                    attributes: meta as AnyValueMap | undefined,
                });
            }
        },
        error(msg: string, err?: Error | unknown, meta?: Record<string, unknown>): void {
            if (logLevelToSeverity('error') >= minSeverity) {
                const errAttrs =
                    err instanceof Error
                        ? { 'error.message': err.message, 'error.stack': err.stack ?? '' }
                        : err !== null && err !== undefined
                            ? { 'error.message': String(err) }
                            : {};
                otelLogger.emit({
                    severityNumber: SeverityNumber.ERROR,
                    body: msg,
                    attributes: { ...meta, ...errAttrs } as AnyValueMap,
                });
            }
        },
    };
};

/**
 * Gracefully flushes and shuts down the OTel providers.
 *
 * Calls `shutdown()` on both the `TracerProvider` and `LoggerProvider` concurrently
 * (via `Promise.allSettled`) so a failure in one does not block the other.
 * After returning, the module-level `tracer`, `_tracerProvider`, and
 * `_loggerProvider` are reset to `null` and `bootstrapped` is cleared, allowing
 * `createLogger` to safely re-initialise OTel in subsequent calls (important for
 * test isolation).
 *
 * Is a no-op when OTel was never bootstrapped (`otelEnabled=false`).
 *
 * @returns A `Promise` that resolves once both providers have finished flushing.
 *
 * @example
 * ```typescript
 * // Flush buffered spans/logs before the process exits:
 * server.on('close', async () => {
 *     await shutdown();
 * });
 * ```
 *
 * @see {@link createLogger} which bootstraps the providers this function tears down
 */
export const shutdown = async (): Promise<void> => {
    if (!bootstrapped) return;
    await Promise.allSettled([
        _tracerProvider?.shutdown(),
        _loggerProvider?.shutdown(),
    ]);
    // Reset state so createLogger can be safely called again (important for test isolation)
    bootstrapped = false;
    tracer = null;
    _tracerProvider = null;
    _loggerProvider = null;
};
