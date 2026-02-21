import type { ConfigResult, ConfigStore, ConfigStores, CortexSettings } from "@/config/types";


/** Provides readonly access to configuration data for stores and Cortex settings. */
export interface ConfigAdapter {
    initialize(): Promise<ConfigResult<void>>;
    /** Retrieves the Cortex settings. */
    getSettings(): Promise<ConfigResult<CortexSettings>>;
    /** Retrieves the list of all configured stores. */
    getStores(): Promise<ConfigResult<ConfigStores>>;
    /** Retrieves the configuration for a specific store by name. */
    getStore(storeName: string): Promise<ConfigResult<ConfigStore | null>>;
}