/**
 * Unit tests for explicit store parameter behavior.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createTestConfig, createTestDir } from './test-utils.ts';
import { addMemoryHandler, type AddMemoryInput } from './add-memory.ts';
import { getMemoryHandler, type GetMemoryInput } from './get-memory.ts';
import type { ToolContext } from './shared.ts';
import { Cortex } from '@yeseh/cortex-core';
import { createFilesystemAdapterFactory } from '@yeseh/cortex-storage-fs';

describe('explicit store parameter', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        const config = createTestConfig(testDir);

        const customStorePath = join(testDir, MEMORY_SUBDIR, 'custom');
        await mkdir(customStorePath, { recursive: true });

        // Update config to use custom default store
        config.defaultStore = 'my-default-store';

        // Create cortex with the custom store
        const cortex = Cortex.init({
            rootDirectory: testDir,
            registry: {
                default: { path: join(testDir, MEMORY_SUBDIR) },
                'my-default-store': { path: customStorePath },
            },
            adapterFactory: createFilesystemAdapterFactory(),
        });

        ctx = { config, cortex };
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should use explicit store from input', async () => {
        const addInput: AddMemoryInput = {
            store: 'my-default-store',
            path: 'project/test',
            content: 'Test',
        };

        await addMemoryHandler(ctx, addInput);

        const getInput: GetMemoryInput = {
            store: 'my-default-store',
            path: 'project/test',
        };

        const result = await getMemoryHandler(ctx, getInput);
        expect(result.content[0]!.text).toContain('Test');
    });
});
