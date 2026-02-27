/**
 * CLI observability — plain ConsoleLogger writing structured JSON to stderr.
 *
 * No OTel SDK dependency — keeps the CLI binary small.
 * Debug output is gated by the `DEBUG=cortex` environment variable.
 *
 * @module cli/observability
 */
import type { Logger } from '@yeseh/cortex-core';

/**
 * Creates a plain console logger for CLI usage.
 *
 * Writes structured JSON log lines to stderr (not stdout) to avoid
 * polluting piped command output. Debug output is gated by the
 * `DEBUG=cortex` environment variable.
 *
 * @returns Logger instance writing to stderr
 *
 * @example
 * ```typescript
 * const logger = createCliLogger();
 * logger.info('Starting command', { store: 'default' });
 * // → {"ts":"2024-01-01T00:00:00.000Z","level":"info","msg":"Starting command","store":"default"}
 * ```
 *
 * @example
 * ```bash
 * # Enable debug output
 * DEBUG=cortex cortex memory list
 * ```
 */
export const createCliLogger = (): Logger => {
    const debugEnabled =
        typeof process.env.DEBUG === 'string' && process.env.DEBUG.includes('cortex');

    const write = (level: string, msg: string, meta?: Record<string, unknown>): void => {
        process.stderr.write(
            JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta }) + '\n',
        );
    };

    return {
        debug(msg: string, meta?: Record<string, unknown>): void {
            if (debugEnabled) write('debug', msg, meta);
        },
        info(msg: string, meta?: Record<string, unknown>): void {
            write('info', msg, meta);
        },
        warn(msg: string, meta?: Record<string, unknown>): void {
            write('warn', msg, meta);
        },
        error(msg: string, err?: Error | unknown, meta?: Record<string, unknown>): void {
            const errMeta =
                err instanceof Error
                    ? { error: err.message, stack: err.stack }
                    : err !== null && err !== undefined
                        ? { error: String(err) }
                        : {};
            write('error', msg, { ...meta, ...errMeta });
        },
    };
};
