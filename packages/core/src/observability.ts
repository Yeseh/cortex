/**
 * Core observability utilities — logger implementations with no external dependencies.
 *
 * @module core/observability
 */

import type { Logger } from './types.ts';

/**
 * No-operation logger that silently discards all log calls.
 *
 * Use as a safe default in tests or embedding contexts where
 * logging is unwanted. Satisfies the `Logger` interface without
 * any I/O side effects.
 *
 * @example
 * ```typescript
 * import { NoopLogger } from '@yeseh/cortex-core';
 *
 * const ctx: CortexContext = {
 *     cortex,
 *     config,
 *     settings,
 *     stores,
 *     now: () => new Date(),
 *     stdin: process.stdin,
 *     stdout: process.stdout,
 *     logger: new NoopLogger(),
 * };
 * ```
 *
 * @see {@link Logger} for the interface contract
 */
export class NoopLogger implements Logger {
    /**
     * No-op. Discards the debug message and metadata without any I/O.
     *
     * @param _msg - Ignored debug message
     * @param _meta - Ignored structured metadata
     */
    debug(_msg: string, _meta?: Record<string, unknown>): void {}

    /**
     * No-op. Discards the info message and metadata without any I/O.
     *
     * @param _msg - Ignored info message
     * @param _meta - Ignored structured metadata
     */
    info(_msg: string, _meta?: Record<string, unknown>): void {}

    /**
     * No-op. Discards the warning message and metadata without any I/O.
     *
     * @param _msg - Ignored warning message
     * @param _meta - Ignored structured metadata
     */
    warn(_msg: string, _meta?: Record<string, unknown>): void {}

    /**
     * No-op. Discards the error message, error object, and metadata without any I/O.
     *
     * @param _msg - Ignored error message
     * @param _err - Ignored Error object or unknown thrown value
     * @param _meta - Ignored structured metadata
     */
    error(_msg: string, _err?: Error | unknown, _meta?: Record<string, unknown>): void {}
}
