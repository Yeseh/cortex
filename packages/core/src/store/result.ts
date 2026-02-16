import { err, type Result } from '@/result.ts';

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

export type StoreError = {
    /** Machine-readable error code for programmatic handling */
    code: StoreErrorCode;
    /** Human-readable error message */
    message: string;
    /** Filesystem or registry path involved in the error (when applicable) */
    path?: string;
    /** Store name involved in the error (when applicable) */
    store?: string;
    /** Line number for parse errors (when applicable) */
    line?: number;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
};

export type StoreErrorForCode<Code extends StoreErrorCode> = StoreError & { code: Code };

export type StoreResult<T, E extends StoreError = StoreError> = Result<T, E>;

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
export const storeError = <Code extends StoreErrorCode>(
    code: Code,
    message: string,
    extras?: Partial<StoreError>
): StoreResult<never, StoreErrorForCode<Code>> =>
    err({
        code,
        message,
        ...extras,
    } as StoreErrorForCode<Code>);

export type StoreRegistryParseErrorCode =
    | 'MISSING_STORES_SECTION'
    | 'INVALID_STORES_SECTION'
    | 'INVALID_STORE_NAME'
    | 'DUPLICATE_STORE_NAME'
    | 'MISSING_STORE_PATH'
    | 'INVALID_STORE_PATH'
    | 'UNEXPECTED_ENTRY';

export type StoreRegistryParseError = StoreErrorForCode<StoreRegistryParseErrorCode>;

export type StoreRegistryLoadErrorCode =
    | 'REGISTRY_READ_FAILED'
    | 'REGISTRY_PARSE_FAILED'
    | 'REGISTRY_MISSING';

export type StoreRegistryLoadError = StoreErrorForCode<StoreRegistryLoadErrorCode>;

export type StoreRegistrySaveErrorCode = 'REGISTRY_WRITE_FAILED' | 'REGISTRY_SERIALIZE_FAILED';

export type StoreRegistrySaveError = StoreErrorForCode<StoreRegistrySaveErrorCode>;

export type StoreRegistrySerializeErrorCode =
    | 'INVALID_STORE_NAME'
    | 'INVALID_STORE_PATH'
    | 'EMPTY_REGISTRY';

export type StoreRegistrySerializeError = StoreErrorForCode<StoreRegistrySerializeErrorCode>;

export type StoreResolveErrorCode = 'STORE_NOT_FOUND';

export type StoreResolveError = StoreErrorForCode<StoreResolveErrorCode> & { store: string };

export type StoreResolutionErrorCode =
    | 'LOCAL_STORE_MISSING'
    | 'GLOBAL_STORE_MISSING'
    | 'STORE_ACCESS_FAILED';

export type StoreResolutionError = StoreErrorForCode<StoreResolutionErrorCode>;

export type InitStoreErrorCode =
    | 'STORE_ALREADY_EXISTS'
    | 'STORE_CREATE_FAILED'
    | 'STORE_INDEX_FAILED'
    | 'REGISTRY_UPDATE_FAILED'
    | 'INVALID_STORE_NAME';

export type InitStoreError = StoreErrorForCode<InitStoreErrorCode>;
