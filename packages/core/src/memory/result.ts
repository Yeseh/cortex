import { err, type Result } from '@/result';

export type MemoryResult<T> = Result<T, MemoryError>;

/**
 * Error details for memory parsing and validation operations.
 *
 * Provides structured error information including an error code for
 * programmatic handling, a human-readable message, and optional
 * context about the specific field or line that caused the error.
 */
export type MemoryError = {
    /** Machine-readable error code for programmatic handling */
    code: MemoryErrorCode;
    /** Human-readable error message */
    message: string;
    /** Field name that caused the error (when applicable) */
    field?: string;
    /** Line number where the error occurred (for parse errors) */
    line?: number;
    /** Memory path that caused the error (when applicable) */
    path?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
};

/**
 * Error codes for memory parsing and validation operations.
 *
 * These codes enable programmatic error handling by consumers:
 * - `MISSING_FRONTMATTER` - The memory file lacks required YAML frontmatter
 * - `INVALID_FRONTMATTER` - The frontmatter YAML is malformed or unparseable
 * - `MISSING_FIELD` - A required field is missing from the frontmatter
 * - `INVALID_TIMESTAMP` - A timestamp field contains an invalid date value
 * - `INVALID_TAGS` - The tags field is not a valid string array
 * - `INVALID_SOURCE` - The source field is missing or not a string
 * - `INVALID_CITATIONS` - The citations field is not a valid string array (must be
 *   an array of non-empty strings when present)
 * - `INVALID_SLUG` - The slug field is missing or not a valid slug
 * - `MEMORY_NOT_FOUND` - The specified memory does not exist in the store
 * - `STORAGE_ERROR` - Underlying storage operation failed (filesystem, network, etc.)
 * - `INVALID_PATH` - Memory path is malformed or doesn't conform to the expected format
 * - `MEMORY_EXPIRED` - The requested memory exists but has passed its expiration date
 * - `INVALID_INPUT` - No updates provided, or invalid arguments
 * - `DESTINATION_EXISTS` - Move destination already exists
 *
 * @example
 * ```typescript
 * // Handling citation validation errors
 * if (result.error.code === 'INVALID_CITATIONS') {
 *     console.error('Citations must be an array of non-empty strings');
 * }
 * ```
 */
export type MemoryErrorCode =
    // Parsing/validation errors
    | 'MISSING_FRONTMATTER'
    | 'INVALID_FRONTMATTER'
    | 'MISSING_FIELD'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TAGS'
    | 'INVALID_SLUG'
    | 'INVALID_SOURCE'
    | 'INVALID_CITATIONS'
    // Operational errors
    | 'MEMORY_NOT_FOUND'
    | 'STORAGE_ERROR'
    | 'INVALID_PATH'
    | 'MEMORY_EXPIRED'
    | 'INVALID_INPUT'
    | 'DESTINATION_EXISTS';

/**
 * Creates a MemoryError with the given code and message.
 *
 * @param code - The error code identifying the type of error
 * @param message - Human-readable error message
 * @param extras - Additional error fields (path, cause, field, etc.)
 * @returns A fully constructed MemoryError object
 *
 * @example
 * ```typescript
 * const error = memoryError('INVALID_PATH', 'Path must contain a category', { path: 'invalid' });
 * ```
 */
export const memoryError = (
    code: MemoryErrorCode,
    message: string,
    extras?: Partial<MemoryError>,
): Result<never, MemoryError> => err({
    code,
    message,
    ...extras,
});
