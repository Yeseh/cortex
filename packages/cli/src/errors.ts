/**
 * Error mapping utilities for CLI commands.
 *
 * This module provides utilities to map core Result errors to Commander.js
 * exceptions. Commander.js uses specific exception types to control error
 * output and exit codes:
 *
 * - `InvalidArgumentError` - For user input validation errors (shows usage help)
 * - `CommanderError` - For other errors (shows error message only)
 *
 * @example
 * ```ts
 * const result = await runAddCommand(options);
 * if (!result.ok) {
 *     mapCoreError(result.error);
 * }
 * ```
 */

import { InvalidArgumentError, CommanderError } from '@commander-js/extra-typings';

/**
 * Represents a core error with a code and message.
 *
 * This interface matches the error shape used throughout the CLI commands,
 * allowing consistent error handling across all command implementations.
 */
export interface CoreError {
    code: string;
    message: string;
}

/**
 * Error codes that indicate invalid user input or arguments.
 *
 * These errors result in `InvalidArgumentError` which causes Commander.js
 * to display usage help alongside the error message.
 *
 * Includes:
 * - Path validation errors (`INVALID_PATH`)
 * - Argument parsing errors (`INVALID_ARGUMENTS`)
 * - Store configuration errors (`INVALID_STORE_NAME`, `INVALID_STORE_PATH`)
 * - Content input errors (`MISSING_CONTENT`, `MULTIPLE_CONTENT_SOURCES`, `CONTENT_INPUT_FAILED`)
 * - Command syntax errors (`INVALID_COMMAND`)
 */
const ARGUMENT_ERROR_CODES = new Set([
    // Path validation
    'INVALID_PATH',
    'INVALID_FILE_PATH',
    'INVALID_SOURCE_PATH',
    'INVALID_DESTINATION_PATH',

    // Argument parsing
    'INVALID_ARGUMENTS',

    // Store configuration
    'INVALID_STORE_NAME',
    'INVALID_STORE_PATH',

    // Content input
    'MISSING_CONTENT',
    'MULTIPLE_CONTENT_SOURCES',
    'CONTENT_INPUT_FAILED',

    // Command syntax
    'INVALID_COMMAND',

    // Git detection (user needs to provide --name)
    'GIT_REPO_REQUIRED',
]);

/**
 * Maps a core error to a Commander.js exception and throws it.
 *
 * This function examines the error code to determine the appropriate
 * Commander.js exception type:
 *
 * - **Argument errors** (`InvalidArgumentError`): For errors caused by invalid
 *   user input. Commander.js displays usage help for these errors.
 *
 * - **Other errors** (`CommanderError`): For system errors, missing resources,
 *   or internal failures. Commander.js displays only the error message.
 *
 * @param error - The core error to map
 * @throws {InvalidArgumentError} When the error code indicates invalid input
 * @throws {CommanderError} For all other error codes
 *
 * @example
 * ```ts
 * // In a command action handler
 * const result = await runShowCommand(options);
 * if (!result.ok) {
 *     mapCoreError(result.error);
 *     // Never reaches here - mapCoreError always throws
 * }
 * ```
 */
export function throwCoreError(error: CoreError): never {
    if (ARGUMENT_ERROR_CODES.has(error.code)) {
        throw new InvalidArgumentError(error.message);
    }

    throw new CommanderError(1, error.code, error.message);
}
