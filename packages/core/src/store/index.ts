// Re-export domain operations
export { initializeStore } from './operations/initialize.ts';

export {
    type StoreError,
    type StoreResult,
    type StoreErrorCode,
    storeError,
} from './result.ts';

export {
    type Store,
} from './store.ts';
