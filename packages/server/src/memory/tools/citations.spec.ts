/**
 * Unit tests for memory citations handling.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createMemoryFile, createTestCategory, createTestContext, createTestDir } from './test-utils.ts';
import type { ToolContext } from './shared.ts';
import { addMemoryHandler, type AddMemoryInput } from './add-memory.ts';
import { getMemoryHandler } from './get-memory.ts';
import { updateMemoryHandler, type UpdateMemoryInput } from './update-memory.ts';

describe('memory citations', () => {
    let testDir: string;
    let ctx: ToolContext;

    beforeEach(async () => {
        testDir = await createTestDir();
        ctx = createTestContext(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should create memory with citations', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createTestCategory(storeRoot, 'project');

        const input: AddMemoryInput = {
            store: 'default',
            path: 'project/with-citations',
            content: 'Memory with citations',
            citations: [
                'src/types.ts:17', 'https://docs.example.com',
            ],
        };

        const result = await addMemoryHandler(ctx, input);
        expect(result.content[0]!.text).toContain('Memory created at project/with-citations');

        const getResult = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/with-citations' },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.citations).toEqual([
            'src/types.ts:17', 'https://docs.example.com',
        ]);
    });

    it('should return citations in get response', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/cited-memory', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [
                    'README.md', 'https://example.com/doc',
                ],
            },
            content: 'Content with citations',
        });

        const result = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/cited-memory' },
        );
        const output = JSON.parse(result.content[0]!.text);

        expect(output.metadata.citations).toEqual([
            'README.md', 'https://example.com/doc',
        ]);
    });

    it('should update citations with overwrite semantics', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/update-citations', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: ['old-citation.ts'],
            },
            content: 'Content',
        });

        const updateInput: UpdateMemoryInput = {
            store: 'default',
            path: 'project/update-citations',
            citations: [
                'new-citation-1.ts', 'new-citation-2.ts',
            ],
        };

        await updateMemoryHandler(ctx, updateInput);

        const getResult = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/update-citations' },
        );
        const output = JSON.parse(getResult.content[0]!.text);
        expect(output.metadata.citations).toEqual([
            'new-citation-1.ts', 'new-citation-2.ts',
        ]);
    });

    it('should return empty citations array for memory without citations', async () => {
        const storeRoot = join(testDir, MEMORY_SUBDIR);
        await createMemoryFile(storeRoot, 'project/no-citations', {
            metadata: {
                createdAt: new Date('2024-01-01'),
                updatedAt: new Date('2024-01-02'),
                tags: [],
                source: 'test',
                citations: [],
            },
            content: 'No citations here',
        });

        const result = await getMemoryHandler(
            ctx,
            { store: 'default', path: 'project/no-citations' },
        );
        const output = JSON.parse(result.content[0]!.text);

        expect(output.metadata.citations).toEqual([]);
    });
});
