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
import { serializeStoreRegistry } from '@yeseh/cortex-core/store';
import { FilesystemStorageAdapter, serializeMemory } from '@yeseh/cortex-storage-fs';
import type { Memory } from '@yeseh/cortex-core/memory';
import { MemoryPath } from '@yeseh/cortex-core/memory';

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
    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
    const pathResult = MemoryPath.fromPath(slugPath);
    if (!pathResult.ok()) {
        throw new Error(`Invalid memory path: ${pathResult.error.message}`);
    }
    const serialized = serializeMemory({ path: pathResult.value, ...contents } as Memory);
    if (!serialized.ok()) {
        throw new Error(`Failed to serialize: ${serialized.error.message}`);
    }
    const result = await adapter.writeMemoryFile(slugPath, serialized.value, {
        allowIndexCreate: true,
        allowIndexUpdate: true,
    });
    if (!result.ok()) {
        throw new Error(`Failed to write: ${result.error.message}`);
    }
};
