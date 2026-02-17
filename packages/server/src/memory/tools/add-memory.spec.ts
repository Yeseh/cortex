/**
 * Unit tests for cortex_add_memory tool.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { createTestContext, createTestDir } from './test-utils.ts';
import type { ToolContext } from './shared.ts';
import { addMemoryHandler, type AddMemoryInput } from './add-memory.ts';
import { getMemoryHandler } from './get-memory.ts';

describe('cortex_add_memory tool', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should create a new memory', async () => {
        const input: AddMemoryInput = {
            store: 'default',
            path: 'project/test-memory',
            content: 'Test content',
        };

        const result = await addMemoryHandler(ctx, input);

        expect(result.content).toHaveLength(1);
        expect(result.content[0]!.text).toContain('Memory created');
        expect(result.content[0]!.text).toContain('project/test-memory');
    });

    it('should create a memory with tags', async () => {
        const input: AddMemoryInput = {
            store: 'default',
            path: 'project/tagged-memory',
            content: 'Content with tags',
            tags: [
                'test', 'example',
            ],
        };

        const result = await addMemoryHandler(ctx, input);
        expect(result.content[0]!.text).toContain('Memory created');

        // Verify by reading back
        const getResult = await getMemoryHandler(
            ctx,
            {
                store: 'default',
                path: 'project/tagged-memory',
            },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.tags).toEqual([
            'test', 'example',
        ]);
    });

    it('should create a memory with expiration', async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        const input: AddMemoryInput = {
            store: 'default',
            path: 'project/expiring-memory',
            content: 'Expiring content',
            expires_at: futureDate,
        };

        const result = await addMemoryHandler(ctx, input);
        expect(result.content[0]!.text).toContain('Memory created');

        // Verify by reading back
        const getResult = await getMemoryHandler(
            ctx,
            {
                store: 'default',
                path: 'project/expiring-memory',
            },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.expires_at).toBeDefined();
    });

    it('should reject unregistered store names', async () => {
        const input: AddMemoryInput = {
            store: 'unregistered-store',
            path: 'project/memory-in-new-store',
            content: 'Content in new store',
        };

        await expect(addMemoryHandler(ctx, input)).rejects.toThrow('not registered');
    });

    it('should reject invalid paths', async () => {
        const input: AddMemoryInput = {
            store: 'default',
            path: 'invalid',
            content: 'Content',
        };

        await expect(addMemoryHandler(ctx, input)).rejects.toThrow();
    });
});
