import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryPath, ok } from '@yeseh/cortex-core';

import { handleRemove } from './remove.ts';
import {
    createCaptureStream,
    createMemoryCommandContext,
    createMemoryFixture,
    createMockMemoryCommandAdapter,
} from './test-helpers.spec.ts';

describe('handleRemove', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-cli-memory-remove-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should throw InvalidArgumentError for invalid memory paths', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
        });

        await expect(handleRemove(ctx, undefined, 'invalid')).rejects.toThrow(
            InvalidArgumentError,
        );
    });

    it('should throw CommanderError when store is missing', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stores: undefined,
        });

        await expect(handleRemove(ctx, 'missing-store', 'project/one')).rejects.toThrow(
            CommanderError,
        );
    });

    it('should remove memory and report output', async () => {
        const memory = createMemoryFixture('project/remove');
        const removeCalls: MemoryPath[] = [];

        const adapter = createMockMemoryCommandAdapter({
            memories: {
                load: async () => ok(memory),
                remove: async (path: MemoryPath) => {
                    removeCalls.push(path);
                    return ok(undefined);
                },
            },
        });

        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter,
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleRemove(ctx, undefined, 'project/remove');

        expect(removeCalls).toHaveLength(1);
        if (removeCalls[0]) {
            expect(removeCalls[0].toString()).toBe('project/remove');
        }
        expect(capture.getOutput()).toContain('Removed memory project/remove.');
    });
});
