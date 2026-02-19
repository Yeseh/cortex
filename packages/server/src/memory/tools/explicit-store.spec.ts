/**
 * Unit tests for explicit store parameter behavior.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createTestCategory, createTestContextWithStores, createTestDir } from './test-utils.ts';
import type { ToolContext } from './shared.ts';
import { addMemoryHandler, type AddMemoryInput } from './add-memory.ts';
import { getMemoryHandler, type GetMemoryInput } from './get-memory.ts';

describe('explicit store parameter', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        
        // Create a custom store path
        const customStorePath = join(testDir, MEMORY_SUBDIR, 'custom');
        await mkdir(customStorePath, { recursive: true });
        
        // Create context with the additional store
        ctx = createTestContextWithStores(testDir, { 'my-default-store': customStorePath });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should use explicit store from input', async () => {
        // Create category in the custom store
        const customStorePath = join(testDir, MEMORY_SUBDIR, 'custom');
        await createTestCategory(customStorePath, 'project');

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
