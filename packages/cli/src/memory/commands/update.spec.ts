import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Memory, MemoryPath, ok } from '@yeseh/cortex-core';

import { handleUpdate } from './update.ts';
import {
    createCaptureStream,
    createMemoryCommandContext,
    createMemoryFixture,
    createMockMemoryCommandAdapter,
} from './test-helpers.spec.ts';

describe('handleUpdate', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-cli-memory-update-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should throw InvalidArgumentError for invalid memory paths', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
        });

        await expect(handleUpdate(ctx, undefined, 'invalid', { content: 'Next' })).rejects.toThrow(
            InvalidArgumentError,
        );
    });

    it('should throw CommanderError when store is missing', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stores: undefined,
        });

        await expect(
            handleUpdate(ctx, 'missing-store', 'project/one', { content: 'Next' }),
        ).rejects.toThrow(CommanderError);
    });

    it('should update memory and report output', async () => {
        const memory = createMemoryFixture('project/update', {}, 'Original content');
        const writeCalls: Memory[] = [];

        const adapter = createMockMemoryCommandAdapter({
            memories: {
                load: async () => ok(memory),
                save: async (_: MemoryPath, next: Memory) => {
                    writeCalls.push(next);
                    return ok(undefined);
                },
            },
            indexes: {
                updateAfterMemoryWrite: async () => ok(undefined),
            },
        });

        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter,
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleUpdate(ctx, undefined, 'project/update', {
            content: 'Updated content',
            tags: ['new-tag'],
        });

        expect(writeCalls).toHaveLength(1);
        if (writeCalls[0]) {
            expect(writeCalls[0].content).toBe('Updated content');
            expect(writeCalls[0].metadata.tags).toEqual(['new-tag']);
        }
        expect(capture.getOutput()).toContain('Updated memory project/update.');
    });
});
