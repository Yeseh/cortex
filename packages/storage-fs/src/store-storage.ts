/**
 * Filesystem implementation of the StoreAdapter interface.
 *
 * This module provides a filesystem-based implementation for storing and
 * managing store metadata. Each store's configuration is persisted in a
 * `store.yaml` file at the store's root directory.
 *
 * @module storage-fs/store-storage
 * @see {@link StoreAdapter} - The interface this class implements
 */

import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { ok, CategoryPath, type Slug } from '@yeseh/cortex-core';
import type { StoreAdapter } from '@yeseh/cortex-core/storage';
import type {
    Store,
    StoreData,
    StoreResult,
} from '@yeseh/cortex-core/store';
import { storeError } from '@yeseh/cortex-core/store';
import type { FilesystemContext } from './types.ts';

type StoreName = Slug;

/** Filename for store configuration */
const STORE_FILENAME = 'store.yaml';

/**
 * YAML schema for store.yaml files (snake_case).
 * Maps to Store type (camelCase) with name provided separately.
 */
interface StoreYaml {
    kind: string;
    category_mode: string;
    categories: StoreYamlCategory[];
    properties: Record<string, unknown>;
    description?: string;
}

interface StoreYamlCategory {
    path: string;
    description?: string;
    subcategories?: StoreYamlCategory[];
}

/**
 * Converts snake_case YAML categories to camelCase Store categories.
 */
function parseCategories(yamlCategories: StoreYamlCategory[]): Store['categories'] {
    return yamlCategories.map((cat) => {
        const pathResult = CategoryPath.fromString(cat.path);
        // Use the parsed CategoryPath, or fallback to root for invalid paths
        const path = pathResult.ok() ? pathResult.value : CategoryPath.root();
        return {
            path,
            description: cat.description,
            subcategories: cat.subcategories ? parseCategories(cat.subcategories) : undefined,
        };
    });
}

/**
 * Converts camelCase Store categories to snake_case YAML categories.
 */
function serializeCategories(categories: Store['categories']): StoreYamlCategory[] {
    return categories.map((cat) => ({
        path: cat.path.toString(),
        ...(cat.description ? { description: cat.description } : {}),
        ...(cat.subcategories && cat.subcategories.length > 0
            ? { subcategories: serializeCategories(cat.subcategories) }
            : {}),
    }));
}

/**
 * Filesystem-based implementation of the StoreAdapter interface.
 *
 * Provides store configuration persistence using YAML files. Each store's
 * configuration is stored in a `store.yaml` file at the store's root directory.
 *
 * Store files use snake_case keys in YAML format, which are converted to
 * camelCase in the internal API:
 *
 * ```yaml
 * kind: memory
 * category_mode: auto
 * categories: []
 * properties: {}
 * description: My project store
 * ```
 *
 * @example
 * ```typescript
 * const ctx: FilesystemContext = {
 *     storeRoot: '/path/to/store',
 *     memoryExtension: '.md',
 *     indexExtension: '.yaml',
 * };
 * const storage = new FilesystemStoreAdapter(ctx);
 *
 * // Load store configuration
 * const result = await storage.load('my-store');
 * if (result.ok() && result.value) {
 *     console.log('Store kind:', result.value.kind);
 * }
 *
 * // Save store configuration
 * await storage.save('my-store', {
 *     kind: 'memory',
 *     categoryMode: 'auto',
 *     categories: [],
 *     properties: {},
 *     description: 'My project store',
 * });
 *
 * // Remove store configuration
 * await storage.remove('my-store');
 * ```
 *
 * @see {@link StoreAdapter} - The interface this class implements
 */
export class FilesystemStoreAdapter implements StoreAdapter {
    /**
     * Creates a new FilesystemStoreAdapter instance.
     *
     * @param ctx - Filesystem context containing storage root and file extensions
     */
    constructor(private readonly ctx: FilesystemContext) {}

    /**
     * Loads the store configuration from the filesystem.
     *
     * Reads and parses the `store.yaml` file from the store's root directory.
     * Returns `null` if the file does not exist (not an error condition).
     *
     * @param name - Name of the store to load (e.g., 'default', 'my-project')
     * @returns Result with Store object if found, null if not found, or StoreError on failure
     *
     * @example
     * ```typescript
     * const result = await storage.load('my-store');
     * if (result.ok()) {
     *     if (result.value !== null) {
     *         console.log('Found store:', result.value.name);
     *         console.log('Kind:', result.value.kind);
     *     } else {
     *         console.log('Store not found');
     *     }
     * } else {
     *     console.error('Load failed:', result.error.message);
     * }
     * ```
     *
     * @edgeCases
     * - Returns `ok(null)` when the store.yaml file does not exist.
     * - Returns `STORE_READ_FAILED` when the file exists but cannot be read or parsed.
     * - Returns `STORE_READ_FAILED` when YAML is malformed or missing required fields.
     */
    async load(name: StoreName): Promise<StoreResult<Store | null>> {
        const filePath = join(this.ctx.storeRoot, STORE_FILENAME);

        let content: string;
        try {
            content = await readFile(filePath, 'utf-8');
        }
        catch (error) {
            // File doesn't exist - return null (not an error)
            if (isNodeError(error) && error.code === 'ENOENT') {
                return ok(null);
            }
            // Other read errors
            return storeError(
                'STORE_READ_FAILED',
                `Failed to read store configuration: ${filePath}. Check file permissions and ensure the path is accessible.`,
                { store: name.toString(), cause: error },
            );
        }

        // Parse YAML
        let yamlData: unknown;
        try {
            yamlData = Bun.YAML.parse(content);
        }
        catch (error) {
            return storeError(
                'STORE_READ_FAILED',
                `Failed to parse store configuration YAML: ${filePath}. Ensure the file contains valid YAML syntax.`,
                { store: name.toString(), cause: error },
            );
        }

        // Validate structure
        const storeYaml = validateStoreYaml(yamlData);
        if (storeYaml === null) {
            return storeError(
                'STORE_READ_FAILED',
                `Invalid store configuration format: ${filePath}. Expected kind, category_mode, categories, and properties fields.`,
                { store: name.toString() },
            );
        }

        // Convert to Store type (snake_case -> camelCase)
        const store: Store = {
            name,
            kind: storeYaml.kind,
            categoryMode: storeYaml.category_mode as Store['categoryMode'],
            categories: parseCategories(storeYaml.categories),
            properties: storeYaml.properties,
            ...(storeYaml.description ? { description: storeYaml.description } : {}),
        };

        return ok(store);
    }

    /**
     * Saves the store configuration to the filesystem.
     *
     * Serializes the store data to YAML and writes it to `store.yaml` in the
     * store's root directory. Creates parent directories if they don't exist.
     *
     * @param name - Name of the store to save (used for error context)
     * @param store - Store data to persist (excludes name, which comes from path)
     * @returns Result indicating success or StoreError on failure
     *
     * @example
     * ```typescript
     * const storeData: StoreData = {
     *     kind: 'memory',
     *     categoryMode: 'auto',
     *     categories: [],
     *     properties: {},
     *     description: 'My project store',
     * };
     *
     * const result = await storage.save('my-store', storeData);
     * if (!result.ok()) {
     *     console.error('Save failed:', result.error.message);
     * }
     * ```
     *
     * @edgeCases
     * - Creates parent directories recursively if they don't exist.
     * - Overwrites existing store.yaml file without warning.
     * - Returns `STORE_WRITE_FAILED` on permission errors or disk failures.
     */
    async save(name: StoreName, store: StoreData): Promise<StoreResult<void>> {
        const filePath = join(this.ctx.storeRoot, STORE_FILENAME);

        // Convert to YAML format (camelCase -> snake_case)
        const yamlData: StoreYaml = {
            kind: store.kind,
            category_mode: store.categoryMode,
            categories: serializeCategories(store.categories),
            properties: store.properties,
            ...(store.description ? { description: store.description } : {}),
        };

        let yamlContent: string;
        try {
            yamlContent = Bun.YAML.stringify(yamlData, null, 2);
        }
        catch (error) {
            return storeError(
                'STORE_WRITE_FAILED',
                'Failed to serialize store configuration to YAML. Check that the store data contains only serializable values.',
                { store: name.toString(), cause: error },
            );
        }

        // Ensure parent directory exists
        try {
            await mkdir(dirname(filePath), { recursive: true });
        }
        catch (error) {
            return storeError(
                'STORE_WRITE_FAILED',
                `Failed to create store directory: ${dirname(filePath)}. Check directory permissions.`,
                { store: name.toString(), cause: error },
            );
        }

        // Write file
        try {
            await writeFile(filePath, yamlContent, 'utf-8');
        }
        catch (error) {
            return storeError(
                'STORE_WRITE_FAILED',
                `Failed to write store configuration: ${filePath}. Check file permissions and available disk space.`,
                { store: name.toString(), cause: error },
            );
        }

        return ok(undefined);
    }

    /**
     * Removes the store configuration file from the filesystem.
     *
     * Deletes the `store.yaml` file from the store's root directory.
     * Silently succeeds if the file doesn't exist (idempotent operation).
     *
     * @param name - Name of the store to remove (used for error context)
     * @returns Result indicating success or StoreError on failure
     *
     * @example
     * ```typescript
     * // Remove store configuration (succeeds even if it doesn't exist)
     * const result = await storage.remove('my-store');
     * if (!result.ok()) {
     *     console.error('Remove failed:', result.error.message);
     * }
     * ```
     *
     * @edgeCases
     * - Silently succeeds if the store.yaml file doesn't exist.
     * - Returns `STORE_WRITE_FAILED` on permission errors or other deletion failures.
     * - Does not remove the store directory itself, only the configuration file.
     */
    async remove(name: StoreName): Promise<StoreResult<void>> {
        const filePath = join(this.ctx.storeRoot, STORE_FILENAME);

        try {
            await unlink(filePath);
        }
        catch (error) {
            // File doesn't exist - that's fine (idempotent)
            if (isNodeError(error) && error.code === 'ENOENT') {
                return ok(undefined);
            }
            // Other errors
            return storeError(
                'STORE_WRITE_FAILED',
                `Failed to remove store configuration: ${filePath}. Check file permissions.`,
                { store: name.toString(), cause: error },
            );
        }

        return ok(undefined);
    }
}

/**
 * Type guard for Node.js errors with error codes.
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}

/**
 * Validates that parsed YAML has the required store structure.
 * Returns StoreYaml if valid, null if invalid.
 */
function validateStoreYaml(data: unknown): StoreYaml | null {
    if (data === null || typeof data !== 'object') {
        return null;
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.kind !== 'string') {
        return null;
    }

    if (typeof obj.category_mode !== 'string') {
        return null;
    }

    if (!Array.isArray(obj.categories)) {
        return null;
    }

    if (typeof obj.properties !== 'object' || obj.properties === null) {
        return null;
    }

    if (obj.description !== undefined && typeof obj.description !== 'string') {
        return null;
    }

    return {
        kind: obj.kind,
        category_mode: obj.category_mode,
        categories: obj.categories as StoreYamlCategory[],
        properties: obj.properties as Record<string, unknown>,
        description: obj.description as string | undefined,
    };
}
