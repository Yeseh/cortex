import type { ConfigResult, ConfigStore, ConfigStores, CortexSettings } from '@/config/types';
import type { CortexConfig } from '..';
import type { StoreData } from '@/store/store.ts';


/** Provides readonly access to configuration data for stores and Cortex settings. */
export interface ConfigAdapter {
    readonly path: string;
    readonly data: CortexConfig | null;
    readonly stores: ConfigStores | null;
    readonly settings: CortexSettings | null;

    initializeConfig(config?: CortexConfig): Promise<ConfigResult<void>>;
    /** Retrieves the Cortex settings. */
    getSettings(): Promise<ConfigResult<CortexSettings>>;
    /** Retrieves the list of all configured stores. */
    getStores(): Promise<ConfigResult<ConfigStores>>;
    /** Retrieves the configuration for a specific store by name. */
    getStore(storeName: string): Promise<ConfigResult<ConfigStore | null>>;
    /** Persists or updates a store definition in configuration. */
    saveStore(storeName: string, data: StoreData): Promise<ConfigResult<void>>;
}
