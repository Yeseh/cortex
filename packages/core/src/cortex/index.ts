/**
 * Cortex module - Root client for the memory system.
 *
 * @module core/cortex
 */

export { Cortex } from './cortex.ts';
export { CategoryClient } from './category-client.ts';
export { StoreClient } from './store-client.ts';
export { MemoryClient } from './memory-client.ts';

export {
    type AdapterFactory,
    type CortexOptions,
    type CortexContext,
    type InitializeError,
    type InitializeErrorCode,
} from './types.ts';
