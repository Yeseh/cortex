import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryPath, ok } from '@yeseh/cortex-core';

import { handleMove } from './move.ts';
import {
    createCaptureStream,
    createMemoryCommandContext,
    createMemoryFixture,
    createMockMemoryCommandAdapter,
} from './test-helpers.spec.ts';

describe('handleMove', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-cli-memory-move-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should throw InvalidArgumentError for invalid memory paths', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
        });

        await expect(handleMove(ctx, undefined, 'invalid', 'project/two')).rejects.toThrow(
            InvalidArgumentError,
        );
    });

    it('should throw CommanderError when store is missing', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stores: undefined,
        });

        await expect(handleMove(ctx, 'missing-store', 'project/one', 'project/two')).rejects.toThrow(
            CommanderError,
        );
    });

    it('should move memory and report output', async () => {
        const memory = createMemoryFixture('project/from');
        const moveCalls: { from: MemoryPath; to: MemoryPath }[] = [];

        const adapter = createMockMemoryCommandAdapter({
            memories: {
                load: async (path: MemoryPath) => {
                    if (path.toString() === 'project/from') {
                        return ok(memory);
                    }
                    return ok(null);
                },
                move: async (from: MemoryPath, to: MemoryPath) => {
                    moveCalls.push({ from, to });
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

        await handleMove(ctx, undefined, 'project/from', 'project/to');

        expect(moveCalls).toHaveLength(1);
        if (moveCalls[0]) {
            expect(moveCalls[0].from.toString()).toBe('project/from');
            expect(moveCalls[0].to.toString()).toBe('project/to');
        }
        expect(capture.getOutput()).toContain('Moved memory project/from to project/to');
    });
});
