/**
 * CLI observability — plain ConsoleLogger writing human-readable lines to stderr.
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
 * Writes human-readable log lines to stderr (not stdout) to avoid
 * polluting piped command output. Debug output is gated by the
 * `DEBUG=cortex` environment variable.
 *
 * @returns Logger instance writing to stderr
 *
 * @example
 * ```typescript
 * const logger = createCliLogger();
 * logger.info('Starting command', { store: 'global' });
 * // → INFO: Starting command store=global
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

    const stringifyMetaValue = (value: unknown): string => {
        if (typeof value === 'string') {
            return value.includes(' ') ? JSON.stringify(value) : value;
        }
        if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
            return String(value);
        }
        return JSON.stringify(value);
    };

    const formatMeta = (meta?: Record<string, unknown>): string => {
        if (!meta || Object.keys(meta).length === 0) return '';
        return Object.entries(meta)
            .map(([key, value]) => `${key}=${stringifyMetaValue(value)}`)
            .join(' ');
    };

    const write = (level: string, msg: string, meta?: Record<string, unknown>): void => {
        const line = `${level.toUpperCase()}: ${msg}`;
        const metaText = formatMeta(meta);
        process.stderr.write(metaText.length > 0 ? `${line} ${metaText}\n` : `${line}\n`);
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
                    ? debugEnabled
                        ? { error: err.message, stack: err.stack }
                        : { error: err.message }
                    : err !== null && err !== undefined
                      ? { error: String(err) }
                      : {};
            write('error', msg, { ...meta, ...errMeta });
        },
    };
};
