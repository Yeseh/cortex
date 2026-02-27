/**
 * Unit tests for the handleAdd command handler.
 *
 * @module cli/memory/commands/add.spec
 */

import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import {
    ok,
    type AdapterFactory,
} from '@yeseh/cortex-core';
import { handleAdd } from './add.ts';
import {
    createCaptureStream,
    createMemoryCommandContext,
    createMockMemoryCommandAdapter,
} from './test-helpers.spec.ts';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleAdd', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-add-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should create a memory and write success message to stdout', async () => {
        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/notes', { content: 'Hello world' });

        const out = capture.getOutput();
        expect(out).toContain('Added memory');
        expect(out).toContain('project/notes');
    });

    it('should pass tags from options', async () => {
        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/tagged', {
            content: 'Tagged memory',
            tags: ['foo', 'bar'],
        });

        expect(capture.getOutput()).toContain('Added memory');
        expect(capture.getOutput()).toContain('project/tagged');
    });

    it('should pass expiresAt from options', async () => {
        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/expiring', {
            content: 'Expires soon',
            expiresAt: '2030-12-31T00:00:00Z',
        });

        expect(capture.getOutput()).toContain('Added memory');
    });

    it('should pass citations from options', async () => {
        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/cited', {
            content: 'Cited memory',
            citations: ['https://example.com/source'],
        });

        expect(capture.getOutput()).toContain('Added memory');
    });

    it('should throw CommanderError when store not found', async () => {
        const failingFactory = (() => undefined) as unknown as AdapterFactory;

        const stdin = new PassThrough();
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stdin,
            adapterFactory: failingFactory,
        });

        await expect(
            handleAdd(ctx, 'nonexistent', 'project/notes', { content: 'test' })
        ).rejects.toThrow(CommanderError);
    });

    it('should throw InvalidArgumentError for MISSING_CONTENT when no content provided', async () => {
        const stdin = new PassThrough();
        stdin.end(); // EOF with no data → empty content → MISSING_CONTENT
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stdin,
        });

        await expect(handleAdd(ctx, undefined, 'project/notes', {})).rejects.toThrow(
            InvalidArgumentError
        );
    });

    it('should throw CommanderError when memory create fails due to missing category', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter({
                categories: {
                    exists: async () => ok(false), // category absent → CATEGORY_NOT_FOUND
                },
            }),
            storePath: tempDir,
        });

        await expect(
            handleAdd(ctx, undefined, 'project/notes', { content: 'test' })
        ).rejects.toThrow(CommanderError);
    });

    it('should use stdin when no content option is provided', async () => {
        const stdin = new PassThrough();
        stdin.end('Content from stdin');
        const capture = createCaptureStream();
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
            stdin,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/stdin', {});

        const out = capture.getOutput();
        expect(out).toContain('Added memory');
        expect(out).toContain('stdin');
    });
});
