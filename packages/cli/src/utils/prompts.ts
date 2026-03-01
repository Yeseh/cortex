/**
 * Shared prompt utilities for interactive CLI commands.
 *
 * Provides TTY detection and injectable prompt dependencies (`PromptDeps`) so
 * command handlers remain fully testable without spawning real terminals.
 *
 * Interactive mode activates automatically when stdin is a TTY (same heuristic
 * as git and npm). In non-TTY environments (CI, pipes, scripts) the prompts are
 * simply skipped.
 *
 * @module cli/prompts
 */

import { input, confirm } from '@inquirer/prompts';

/**
 * Async function that prompts the user for a text value.
 *
 * @param opts - Prompt options
 * @param opts.message - The prompt message displayed to the user
 * @param opts.default - The default value shown in the prompt
 * @returns A promise resolving to the user's input or the default
 */
export type InputFn = (opts: { message: string; default?: string }) => Promise<string>;

/**
 * Async function that prompts the user for a boolean confirmation.
 *
 * @param opts - Prompt options
 * @param opts.message - The prompt message displayed to the user
 * @param opts.default - The default answer (true = yes, false = no)
 * @returns A promise resolving to the user's answer
 */
export type ConfirmFn = (opts: { message: string; default?: boolean }) => Promise<boolean>;

/**
 * Injectable dependencies for interactive prompts.
 *
 * Pass real functions (from `@inquirer/prompts`) in production and stub
 * implementations in tests to avoid blocking on terminal input.
 *
 * @example
 * ```typescript
 * // Production
 * const deps = defaultPromptDeps;
 *
 * // Test stub
 * const deps: PromptDeps = {
 *     input: async ({ default: d }) => d ?? 'test-value',
 *     confirm: async () => true,
 * };
 * ```
 */
export interface PromptDeps {
    input: InputFn;
    confirm: ConfirmFn;
}

/**
 * Default prompt dependencies backed by `@inquirer/prompts`.
 * Use this in production; inject stubs in tests.
 */
export const defaultPromptDeps: PromptDeps = { input, confirm };

/**
 * Checks whether the given readable stream is an interactive terminal (TTY).
 *
 * Returns `true` only when `stream.isTTY === true`. Returns `false` for:
 * - `undefined` stream
 * - streams without an `isTTY` property (e.g. `PassThrough`)
 * - streams where `isTTY` is `false`
 *
 * This mirrors the same heuristic used by git and npm for auto-detecting
 * interactive mode.
 *
 * @param stream - The readable stream to check (usually `ctx.stdin`)
 * @returns `true` if the stream is a TTY, `false` otherwise
 *
 * @example
 * ```typescript
 * if (isTTY(ctx.stdin)) {
 *     // Show interactive prompts
 * }
 * ```
 */
export function isTTY(stream: NodeJS.ReadableStream | undefined): boolean {
    return (stream as NodeJS.ReadStream | undefined)?.isTTY === true;
}
