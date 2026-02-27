import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ok } from '@yeseh/cortex-core';

import { handleShow } from './show.ts';
import {
    createCaptureStream,
    createMemoryCommandContext,
    createMemoryFixture,
    createMockMemoryCommandAdapter,
} from './test-helpers.spec.ts';

describe('handleShow', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-cli-memory-show-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should throw InvalidArgumentError for invalid memory paths', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
        });

        await expect(handleShow(ctx, undefined, 'invalid', { format: 'yaml' })).rejects.toThrow(
            InvalidArgumentError,
        );
    });

    it('should throw CommanderError when store is missing', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stores: undefined,
        });

        await expect(handleShow(ctx, 'missing-store', 'project/one', { format: 'yaml' })).rejects.toThrow(
            CommanderError,
        );
    });

    it('should output serialized memory details', async () => {
        const memory = createMemoryFixture('project/show', {}, 'Show content');
        const adapter = createMockMemoryCommandAdapter({
            memories: {
                load: async () => ok(memory),
            },
        });
        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter,
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleShow(ctx, undefined, 'project/show', { format: 'json' });

        const output = JSON.parse(capture.getOutput());
        expect(output.path).toBe('project/show');
        expect(output.content).toBe('Show content');
        expect(output.metadata.tags).toEqual(['test']);
    });
});
