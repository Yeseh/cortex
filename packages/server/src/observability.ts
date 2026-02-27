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

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Lightweight console logger writing structured JSON to stderr.
 * No OTel dependency — used when CORTEX_OTEL_ENABLED=false (default).
 */
class ConsoleLogger implements Logger {
    constructor(private readonly level: LogLevel) {}

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[this.level];
    }

    private write(level: string, msg: string, meta?: Record<string, unknown>): void {
        process.stderr.write(
            JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta }) + '\n',
        );
    }

    debug(msg: string, meta?: Record<string, unknown>): void {
        if (this.shouldLog('debug')) this.write('debug', msg, meta);
    }

    info(msg: string, meta?: Record<string, unknown>): void {
        if (this.shouldLog('info')) this.write('info', msg, meta);
    }

    warn(msg: string, meta?: Record<string, unknown>): void {
        if (this.shouldLog('warn')) this.write('warn', msg, meta);
    }

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

// IMPORTANT: Map LogLevel string to OTel SeverityNumber
// debug=5, info=9, warn=13, error=17 (OTel spec values)
function logLevelToSeverity(level: LogLevel): number {
    switch (level) {
        case 'debug':
            return 5;
        case 'info':
            return 9;
        case 'warn':
            return 13;
        case 'error':
            return 17;
        default:
            return 9;
    }
}

/**
 * Module-level tracer — set when OTel is enabled, null otherwise.
 * Imported by tracing.ts for span-per-tool-call instrumentation.
 */
export let tracer: Tracer | null = null;

/**
 * Creates a logger for the MCP server.
 *
 * @param logLevel - Minimum log level to emit
 * @param otelEnabled - When true, bootstrap full OTel SDK with ConsoleExporters
 * @returns Logger instance (ConsoleLogger or OTel-backed)
 *
 * @example
 * ```typescript
 * const logger = createLogger('info', false); // Plain ConsoleLogger to stderr
 * const otelLogger = createLogger('debug', true); // OTel to stdout
 * ```
 */
export const createLogger = (logLevel: LogLevel, otelEnabled: boolean): Logger => {
    if (!otelEnabled) {
        return new ConsoleLogger(logLevel);
    }

    const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'cortex-memory' });

    // Bootstrap TracerProvider — processors go in constructor config (OTel SDK v2)
    const tracerProvider = new NodeTracerProvider({
        resource,
        spanProcessors: [new BatchSpanProcessor(new ConsoleSpanExporter())],
    });
    tracerProvider.register();
    tracer = tracerProvider.getTracer('cortex-memory');

    // Bootstrap LoggerProvider — processors go in constructor config (OTel SDK v2)
    const loggerProvider = new LoggerProvider({
        resource,
        processors: [new BatchLogRecordProcessor(new ConsoleLogRecordExporter())],
    });
    logs.setGlobalLoggerProvider(loggerProvider);

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
