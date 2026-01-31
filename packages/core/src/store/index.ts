/**
 * Store management module.
 *
 * @module core/store
 */

// Re-export registry parsing utilities
export {
    parseStoreRegistry,
    serializeStoreRegistry,
    isValidStoreName,
    resolveStorePath,
    type StoreDefinition,
    type StoreRegistry,
    type StoreRegistryParseError,
    type StoreRegistryParseErrorCode,
    type StoreRegistryLoadError,
    type StoreRegistryLoadErrorCode,
    type StoreRegistrySaveError,
    type StoreRegistrySaveErrorCode,
    type StoreRegistrySerializeError,
    type StoreRegistrySerializeErrorCode,
    type StoreResolveError,
    type StoreResolveErrorCode,
} from './registry.ts';

// Re-export domain operations
export {
    initializeStore,
    type InitStoreError,
    type InitStoreErrorCode,
    type InitStoreOptions,
} from './operations.ts';

// Re-export store resolution (for local/global fallback)
export {
    resolveStore,
    type StoreResolution,
    type StoreResolutionError,
    type StoreResolutionErrorCode,
    type StoreResolutionOptions,
    type ResolveStoreResult,
} from './store.ts';
