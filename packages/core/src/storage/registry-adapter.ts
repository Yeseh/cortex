import type { ErrorDetails, Result } from "@/result";
import type { ConfigStore } from "@/config/types";
import type { StoreResult } from "@/store";
import type { Registry } from "@/store/store";

/**
 * Error codes for registry operations.
 *
 * - `REGISTRY_MISSING` - Registry file does not exist at the expected path
 * - `REGISTRY_READ_FAILED` - Unable to read registry file (permissions, I/O error)
 * - `REGISTRY_WRITE_FAILED` - Unable to write registry file (permissions, disk full)
 * - `REGISTRY_PARSE_FAILED` - Registry file exists but contains invalid YAML/data
 */
export type RegistryErrorCode =
    | 'REGISTRY_MISSING'
    | 'REGISTRY_READ_FAILED'
    | 'REGISTRY_WRITE_FAILED'
    | 'REGISTRY_PARSE_FAILED';


/**
 * Error details for registry operations.
 *
 * Provides structured error information including an error code for
 * programmatic handling, a human-readable message, and optional
 * context about the failing path or underlying cause.
 *
 * @example
 * ```typescript
 * const result = await registry.load();
 * if (!result.ok) {
 *   switch (result.error.code) {
 *     case 'REGISTRY_MISSING':
 *       console.log('Run "cortex init" to create a registry');
 *       break;
 *     case 'REGISTRY_PARSE_FAILED':
 *       console.log('Registry file is corrupted:', result.error.cause);
 *       break;
 *   }
 * }
 * ```
 */
export type RegistryError  = ErrorDetails<RegistryErrorCode>;
export type RegistryResult<T> = Result<T, RegistryError>;

/**
 * Registry interface for managing store configurations.
 *
 * The registry is a central configuration file that maps store names to their
 * filesystem paths. Implementations cache loaded data internally, enabling
 * synchronous {@link getStore} calls after {@link load}.
 *
 * The registry serves as a factory for obtaining storage adapters scoped to
 * specific stores, ensuring each store's operations are isolated.
 *
 * **Typical usage pattern:**
 * 1. Call {@link initialize} once during first-time setup
 * 2. Call {@link load} to read and cache registry data
 * 3. Call {@link getStore} synchronously to get store-specific adapters
 * 4. Call {@link save} when registry changes (e.g., adding new stores)
 *
 * @example
 * ```typescript
 * // Setup and usage
 * const registry = new FilesystemRegistry('/path/to/stores.yaml');
 * await registry.load();
 *
 * const adapter = registry.getStore('my-project');
 * if (adapter.ok) {
 *   const content = await adapter.value.memories.read('category/memory');
 *   console.log(content.value);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // First-time initialization
 * const registry = new FilesystemRegistry('/path/to/stores.yaml');
 * await registry.initialize();  // Creates file if missing
 * const result = await registry.load();
 * if (result.ok) {
 *   console.log('Registered stores:', Object.keys(result.value));
 * }
 * ```
 */
export interface RegistryAdapter {
    /**
     * First-time registry setup.
     *
     * Initializes the registry in the backing storage system.
     * Safe to call if registry already exists (no-op in that case).
     *
     * @returns Result with void on success, or {@link RegistryError} on failure
     *
     * @example
     * ```typescript
     * const result = await registry.initialize();
     * if (!result.ok) {
     *   console.error('Failed to initialize:', result.error.message);
     * }
     * ```
     */
    initialize(): Promise<RegistryResult<void>>;
}

