export type { StoreRegistryParseError, StoreRegistryParseErrorCode } from './result.ts';

// Re-export domain operations
export { initializeStore, type InitStoreOptions } from './operations/index.ts';
export type { InitStoreError, InitStoreErrorCode } from './result.ts';

// Re-export store resolution (for local/global fallback)
export {
    resolveStore,
    type StoreResolution,
    type StoreResolutionError,
    type StoreResolutionErrorCode,
    type StoreResolutionOptions,
    type ResolveStoreResult,
} from './store.ts';
