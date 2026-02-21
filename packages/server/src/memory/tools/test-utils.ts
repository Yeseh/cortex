/**
 * Test helpers for memory tools.
 *
 * @module server/memory/tools/test-utils
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ServerConfig } from '../../config.ts';
import { MEMORY_SUBDIR } from '../../config.ts';
import { type Memory, Cortex } from '@yeseh/cortex-core';
import { createMemory } from '@yeseh/cortex-core/memory';
import { createCategory } from '@yeseh/cortex-core/category';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import type { ToolContext } from './shared.ts';

// Type for test store configuration
type TestStoreConfig = Record<string, {
    kind: string;
    properties: { path: string };
    categories: Record<string, unknown>;
}>;

// Test configuration
export const createTestConfig = (dataPath: string): ServerConfig => ({
    dataPath,
    port: 3000,
    host: '127.0.0.1',
    defaultStore: 'default',
    logLevel: 'info',
    outputFormat: 'yaml',
    autoSummaryThreshold: 500,
});

/**
 * Creates a ToolContext for testing with both config and cortex instance.
 *
 * @param testDir - The test directory (from createTestDir)
 * @returns A ToolContext ready for use in test handlers
 */
export const createTestContext = (testDir: string): ToolContext => {
    const config = createTestConfig(testDir);
    const memoryDir = join(testDir, MEMORY_SUBDIR);

    // Create store configuration mapping
    const storeConfig: TestStoreConfig = {
        default: {
            kind: 'filesystem',
            properties: { path: memoryDir },
            categories: {},
        },
    };

    const cortex = Cortex.init({
        // Type compatibility - will be fixed in core migration
        stores: storeConfig as any,
        adapterFactory: (storeName: string) => {
            // Lookup the store path from config
            const store = storeConfig[storeName];
            const storePath = store ? store.properties.path : memoryDir;
            return new FilesystemStorageAdapter({ rootDirectory: storePath });
        },
    });

    return { config, cortex };
};

/**
 * Creates a ToolContext with multiple stores registered.
 *
 * @param testDir - The test directory (from createTestDir)
 * @param additionalStores - Additional stores to register (name -> path mapping)
 * @returns A ToolContext with multiple stores configured
 */
export const createTestContextWithStores = (
    testDir: string,
    additionalStores: Record<string, string>,
): ToolContext => {
    const config = createTestConfig(testDir);
    const memoryDir = join(testDir, MEMORY_SUBDIR);

    const storeConfig: TestStoreConfig = {
        default: {
            kind: 'filesystem',
            properties: { path: memoryDir },
            categories: {},
        },
    };

    for (const [
        name, path,
    ] of Object.entries(additionalStores)) {
        storeConfig[name] = {
            kind: 'filesystem',
            properties: { path },
            categories: {},
        };
    }

    const cortex = Cortex.init({
        // Type compatibility - will be fixed in core migration
        stores: storeConfig as any,
        adapterFactory: (storeName: string) => {
            // Lookup the store path from config
            const store = storeConfig[storeName];
            const storePath = store ? store.properties.path : memoryDir;
            return new FilesystemStorageAdapter({ rootDirectory: storePath });
        },
    });

    return { config, cortex };
};

/**
 * Creates a test directory for test stores.
 *
 * Creates a temporary directory with a memory subdirectory for the default store.
 * Use this with `createTestContext()` or `createTestContextWithStores()` to set up
 * a test environment.
 *
 * @returns Path to the test directory
 *
 * @example
 * ```typescript
 * const testDir = await createTestDir();
 * const ctx = createTestContext(testDir);
 * ```
 */
export const createTestDir = async (): Promise<string> => {
    const testDir = join(
        tmpdir(),
        `cortex-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(testDir, { recursive: true });

    // Create memory subdirectory for default store
    const memoryDir = join(testDir, MEMORY_SUBDIR);
    await mkdir(memoryDir, { recursive: true });

    return testDir;
};

/**
 * Creates a category in a test store.
 *
 * Utility function for test setup that creates a category at the specified
 * path within a test store. Uses the core `createCategory` operation with
 * a fresh FilesystemStorageAdapter instance.
 *
 * @module server/memory/tools/test-utils
 * @param storeRoot - Absolute path to the store's root directory
 * @param categoryPath - Category path to create (e.g., "project/cortex")
 * @returns Promise that resolves when the category is created
 * @throws Error if category creation fails (wraps the core error message)
 *
 * @example
 * ```typescript
 * const testDir = await createTestDir();
 * const storeRoot = join(testDir, MEMORY_SUBDIR);
 *
 * // Create a simple category
 * await createTestCategory(storeRoot, 'project');
 *
 * // Create a nested category (auto-creates parents)
 * await createTestCategory(storeRoot, 'project/cortex/docs');
 * ```
 *
 * @edgeCases
 * - Creating an existing category succeeds (operation is idempotent)
 * - Parent categories are auto-created if missing
 * - Throws on invalid paths (empty, malformed)
 */
export const createTestCategory = async (
    storeRoot: string,
    categoryPath: string,
): Promise<void> => {
    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
    const result = await createCategory(adapter.categories, categoryPath);
    if (!result.ok()) {
        throw new Error(`Failed to create category '${categoryPath}': ${result.error.message}`);
    }
};

// Helper to create a memory file directly
export const createMemoryFile = async (
    storeRoot: string,
    slugPath: string,
    contents: Partial<Memory>,
): Promise<void> => {
    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });

    // Extract category path from memory path and ensure it exists
    const pathSegments = slugPath.split('/');
    if (pathSegments.length >= 2) {
        const categoryPath = pathSegments.slice(0, -1).join('/');
        // Create category (idempotent - succeeds if already exists)
        const categoryResult = await createCategory(adapter.categories, categoryPath);
        if (!categoryResult.ok()) {
            throw new Error(`Failed to create category '${categoryPath}': ${categoryResult.error.message}`);
        }
    }

    const result = await createMemory(
        adapter,
        slugPath,
        {
            content: contents.content!,
            metadata: {
                tags: contents.metadata?.tags ?? [],
                source: contents.metadata?.source ?? 'test',
                citations: contents.metadata?.citations ?? [],
                expiresAt: contents.metadata?.expiresAt,
                createdAt: contents.metadata?.createdAt ?? new Date(),
                updatedAt: contents.metadata?.updatedAt ?? new Date(),
            },
        },
        contents.metadata?.createdAt, // Pass timestamp for test determinism
    );

    if (!result.ok()) {
        throw new Error(`Failed to create memory: ${result.error.message}`);
    }
};
