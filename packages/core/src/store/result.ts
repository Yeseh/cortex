import { err, type ErrorDetails, type Result } from '@/result.ts';

/**
 * Store module result helpers.
 *
 * @module core/store/result
 */

export type StoreErrorCode =
    | 'STORE_NOT_FOUND'
    | 'STORE_ALREADY_EXISTS'
    | 'DUPLICATE_STORE_NAME'
    | 'STORE_CREATE_FAILED'
    | 'STORE_CRATE_FAILED'
    | 'STORE_SAVE_FAILED'
    | 'STORE_INIT_FAILED'
    | 'STORE_NAME_INVALID'
    | 'MISSING_STORE_PATH'
    | 'INVALID_STORE_NAME';

export type StoreError = ErrorDetails<StoreErrorCode> & {
    store?: string;
};
export type StoreResult<T> = Result<T, StoreError>;

/**
 * Creates a StoreError result with the given code and message.
 *
 * @module core/store/result
 * @param code - Error code identifying the failure
 * @param message - Human-readable error message
 * @param extras - Additional error fields (path, store, line, cause)
 * @returns StoreResult containing the StoreError
 * @example
 * ```typescript
 * const result = storeError('INVALID_STORE_NAME', 'Store name is invalid', { store: 'MyStore' });
 * if (!result.ok()) {
 *   console.error(result.error.code);
 * }
 * ```
 * @edgeCases
 * - When `extras` is undefined, only the code and message are set.
 */
export const storeError = (
    code: StoreErrorCode,
    message: string,
    extras?: Partial<StoreError>,
): Result<never, StoreError> =>
    err({
        code,
        message,
        ...extras,
    } as StoreError);