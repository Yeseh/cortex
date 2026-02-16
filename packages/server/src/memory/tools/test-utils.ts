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
import { FilesystemStorageAdapter, createFilesystemAdapterFactory } from '@yeseh/cortex-storage-fs';
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

// Helper to create test directory with store directory
export const createTestDir = async (): Promise<string> => {
    const testDir = join(
        tmpdir(),
        `cortex-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });

    // Create memory subdirectory for default store
    const memoryDir = join(testDir, MEMORY_SUBDIR);
    await mkdir(memoryDir, { recursive: true });

    return testDir;
};

// Helper to register an additional store in the registry
// Updates both the filesystem registry and the Cortex instance
export const registerStore = async (
    ctx: ToolContext,
    storeName: string,
    storePath: string
): Promise<void> => {
    // Create the store directory
    await mkdir(storePath, { recursive: true });

    // Add store to Cortex (mutates in-memory registry and persists to config.yaml)
    const result = await ctx.cortex.addStore(storeName, { path: storePath });
    if (!result.ok()) {
        throw new Error(`Failed to register store: ${result.error.message}`);
    }
};

// Helper to create a memory file directly
export const createMemoryFile = async (
    storeRoot: string,
    slugPath: string,
    contents: Partial<Memory>
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
        contents.metadata?.createdAt // Pass timestamp for test determinism
    );

    if (!result.ok()) {
        throw new Error(`Failed to create memory: ${result.error.message}`);
    }
};

// Helper to create a complete test context including Cortex instance
export const createTestContext = async (): Promise<{ testDir: string; ctx: ToolContext }> => {
    const testDir = await createTestDir();
    const memoryDir = join(testDir, MEMORY_SUBDIR);
    const config = createTestConfig(testDir);
    const registry = { default: { path: memoryDir } };
    const cortex = Cortex.init({
        rootDirectory: testDir,
        registry,
        adapterFactory: createFilesystemAdapterFactory(),
    });

    return { testDir, ctx: { config, cortex } };
};
