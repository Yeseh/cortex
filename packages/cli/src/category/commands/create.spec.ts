/**
 * Unit tests for the handleCreate command handler.
 *
 * @module cli/category/commands/create.spec
 */

import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { err, ok } from '@yeseh/cortex-core';
import { type AdapterFactory } from '@yeseh/cortex-core';

import { handleCreate } from './create.ts';
import {
    createCaptureStream,
    createMemoryCommandContext,
    createMockMemoryCommandAdapter,
} from '../../memory/commands/test-helpers.spec.ts';

describe('handleCreate', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-category-create-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should write "Created <path>" to stdout when category is new', async () => {
        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter({
                categories: {
                    exists: async () => ok(false),
                    ensure: async () => ok(undefined),
                },
            }),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleCreate(ctx, undefined, 'standards/typescript');

        const output = capture.getOutput();
        expect(output).toContain('Created');
        expect(output).toContain('standards/typescript');
    });

    it('should write already exists message when category exists', async () => {
        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter({
                categories: {
                    exists: async () => ok(true),
                },
            }),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleCreate(ctx, undefined, 'standards/typescript');

        const output = capture.getOutput();
        expect(output).toContain('Category already exists');
        expect(output).toContain('standards/typescript');
    });

    it('should serialize as JSON when --format json is passed', async () => {
        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter({
                categories: {
                    exists: async () => ok(false),
                    ensure: async () => ok(undefined),
                },
            }),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleCreate(ctx, undefined, 'standards', { format: 'json' });

        const parsed = JSON.parse(capture.getOutput());
        expect(parsed.path).toBe('standards');
        expect(parsed.created).toBeTrue();
    });

    it('should throw CommanderError when store not found', async () => {
        const failingFactory = (() => undefined) as unknown as AdapterFactory;

        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            adapterFactory: failingFactory,
        });

        await expect(handleCreate(ctx, 'nonexistent', 'standards')).rejects.toThrow(CommanderError);
    });

    it('should throw InvalidArgumentError for INVALID_PATH errors', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter({
                categories: {
                    exists: async () => ok(false),
                    ensure: async () => err({
                        code: 'INVALID_PATH',
                        message: 'Invalid category path: /',
                    }),
                },
            }),
            storePath: tempDir,
        });

        await expect(handleCreate(ctx, undefined, 'standards')).rejects.toThrow(InvalidArgumentError);
    });

    it('should throw CommanderError when storage ensure fails', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter({
                categories: {
                    exists: async () => ok(false),
                    ensure: async () => err({
                        code: 'WRITE_FAILED',
                        message: 'Failed to write category index.',
                    }),
                },
            }),
            storePath: tempDir,
        });

        await expect(handleCreate(ctx, undefined, 'standards/typescript')).rejects.toThrow(
            CommanderError,
        );
    });
});
