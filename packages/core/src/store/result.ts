import { err, type ErrorDetails, type Result } from '@/result.ts';

/**
 * Store module result helpers.
 *
 * @module core/store/result
 */

export type StoreErrorCode =
    | 'LOCAL_STORE_MISSING'
    | 'GLOBAL_STORE_MISSING'
    | 'STORE_ACCESS_FAILED'
    | 'MISSING_STORES_SECTION'
    | 'INVALID_STORES_SECTION'
    | 'INVALID_STORE_NAME'
    | 'DUPLICATE_STORE_NAME'
    | 'MISSING_STORE_PATH'
    | 'INVALID_STORE_PATH'
    | 'UNEXPECTED_ENTRY'
    | 'REGISTRY_READ_FAILED'
    | 'REGISTRY_PARSE_FAILED'
    | 'REGISTRY_MISSING'
    | 'REGISTRY_WRITE_FAILED'
    | 'REGISTRY_SERIALIZE_FAILED'
    | 'EMPTY_REGISTRY'
    | 'STORE_NOT_FOUND'
    | 'STORE_ALREADY_EXISTS'
    | 'STORE_CREATE_FAILED'
    | 'STORE_INDEX_FAILED'
    | 'REGISTRY_UPDATE_FAILED';

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