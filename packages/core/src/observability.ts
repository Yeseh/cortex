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
 */
export class NoopLogger implements Logger {
    /** @inheritdoc */
    debug(_msg: string, _meta?: Record<string, unknown>): void {}
    /** @inheritdoc */
    info(_msg: string, _meta?: Record<string, unknown>): void {}
    /** @inheritdoc */
    warn(_msg: string, _meta?: Record<string, unknown>): void {}
    /** @inheritdoc */
    error(_msg: string, _err?: Error | unknown, _meta?: Record<string, unknown>): void {}
}
