// Re-export domain operations
export { initializeStore } from './operations/initialize.ts';

export {
    type StoreError,
    type StoreResult,
    type StoreErrorCode,
    storeError,
} from './result.ts';

export {
    type StoreClient,
} from './store-client.ts';

export {
    type Store,
    type StoreData,
} from './store.ts';
