/**
 * Cortex module - Root client for the memory system.
 *
 * @module core/cortex
 */

export { Cortex } from './cortex.ts';
export { CategoryClient } from './category-client.ts';
export { StoreClient } from './store-client.ts';

export {
    type AdapterFactory,
    type CortexSettings,
    type CortexOptions,
    type CortexContext,
    type ConfigError,
    type ConfigErrorCode,
    type InitializeError,
    type InitializeErrorCode,
    DEFAULT_SETTINGS,
} from './types.ts';
