/**
 * Test helpers for memory tools.
 *
 * @module server/memory/tools/test-utils
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ServerConfig } from '../../config.ts';
import { MEMORY_SUBDIR } from '../../config.ts';
import { type Memory, serializeStoreRegistry, Cortex } from '@yeseh/cortex-core';
import { createMemory } from '@yeseh/cortex-core/memory';
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';
import type { ToolContext } from './shared.ts';

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

    const cortex = Cortex.init({
        rootDirectory: testDir,
        registry: { default: { path: memoryDir } },
        adapterFactory: (storePath: string) => new FilesystemStorageAdapter({ rootDirectory: storePath }),
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

    const registry: Record<string, { path: string }> = {
        default: { path: memoryDir },
    };

    for (const [
        name, path,
    ] of Object.entries(additionalStores)) {
        registry[name] = { path };
    }

    const cortex = Cortex.init({
        rootDirectory: testDir,
        registry,
        adapterFactory: (storePath: string) => new FilesystemStorageAdapter({ rootDirectory: storePath }),
    });

    return { config, cortex };
};

// Helper to create test directory with store registry
export const createTestDir = async (): Promise<string> => {
    const testDir = join(
        tmpdir(),
        `cortex-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(testDir, { recursive: true });

    // Create stores.yaml registry pointing default store to memory subdirectory
    const memoryDir = join(testDir, MEMORY_SUBDIR);
    await mkdir(memoryDir, { recursive: true });
    const registry = { default: { path: memoryDir } };
    const serialized = serializeStoreRegistry(registry);
    if (!serialized.ok()) {
        throw new Error(`Failed to serialize registry: ${serialized.error.message}`);
    }
    await writeFile(join(testDir, 'stores.yaml'), serialized.value);

    return testDir;
};

// Helper to register an additional store in the registry
export const registerStore = async (
    testDir: string,
    storeName: string,
    storePath: string,
): Promise<void> => {
    const registryPath = join(testDir, 'stores.yaml');
    const memoryDir = join(testDir, MEMORY_SUBDIR);

    // Create the store directory
    await mkdir(storePath, { recursive: true });

    // Build registry with default + new store
    const registry = {
        default: { path: memoryDir },
        [storeName]: { path: storePath },
    };
    const serialized = serializeStoreRegistry(registry);
    if (!serialized.ok()) {
        throw new Error(`Failed to serialize registry: ${serialized.error.message}`);
    }
    await writeFile(registryPath, serialized.value);
};

// Helper to create a memory file directly
export const createMemoryFile = async (
    storeRoot: string,
    slugPath: string,
    contents: Partial<Memory>,
): Promise<void> => {
    // Use the proper core createMemory operation which updates indexes
    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });

    const result = await createMemory(
        adapter,
        slugPath,
        {
            content: contents.content!,
            tags: contents.metadata?.tags ?? [],
            source: contents.metadata?.source ?? 'test',
            citations: contents.metadata?.citations ?? [],
            expiresAt: contents.metadata?.expiresAt,
        },
        contents.metadata?.createdAt, // Pass timestamp for test determinism
    );

    if (!result.ok()) {
        throw new Error(`Failed to create memory: ${result.error.message}`);
    }
};
