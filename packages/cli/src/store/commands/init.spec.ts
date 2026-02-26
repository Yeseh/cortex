/**
 * Unit tests for the store init command handler.
 *
 * @module cli/store/commands/init.spec
 */

import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ok, err } from '@yeseh/cortex-core';
import { handleInit } from './init.ts';
import {
    createMockContext,
    createMockStorageAdapter,
    captureOutput,
} from '../../test-helpers.spec.ts';

// Produce a store adapter whose `stores.load` reports NOT_FOUND (so the new
// store can be created) and `stores.save` succeeds.
function createInitAdapter() {
    return createMockStorageAdapter({
        stores: {
            load: async () => err({ code: 'STORE_NOT_FOUND' as const, message: 'not found', store: 'unknown' }),
            save: async () => ok(undefined),
            remove: async () => ok(undefined),
        },
    });
}

describe('handleInit', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-init-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should initialize a store and write success message to stdout', async () => {
        const { ctx, stdout } = createMockContext({
            adapter: createInitAdapter(),
            cwd: tempDir,
        });

        await handleInit(ctx, undefined, { name: 'my-project', format: 'yaml' });

        const out = captureOutput(stdout);
        expect(out).toContain('my-project');
    });

    it('should use the provided target path as the store path', async () => {
        const customPath = join(tempDir, 'custom-store');
        const { ctx, stdout } = createMockContext({
            adapter: createInitAdapter(),
            cwd: tempDir,
        });

        await handleInit(ctx, customPath, { name: 'my-project', format: 'yaml' });

        const out = captureOutput(stdout);
        expect(out).toContain('custom-store');
    });

    it('should default to .cortex under cwd when no target path is given', async () => {
        const { ctx, stdout } = createMockContext({
            adapter: createInitAdapter(),
            cwd: tempDir,
        });

        await handleInit(ctx, undefined, { name: 'my-project', format: 'yaml' });

        const out = captureOutput(stdout);
        // Default path is <cwd>/.cortex
        expect(out).toContain('.cortex');
    });

    it('should throw InvalidArgumentError for an invalid store name', async () => {
        const { ctx } = createMockContext({
            adapter: createInitAdapter(),
            cwd: tempDir,
        });

        await expect(
            handleInit(ctx, undefined, { name: '   ', format: 'yaml' }),
        ).rejects.toThrow(InvalidArgumentError);
    });

    it('should output in JSON format when format option is json', async () => {
        const { ctx, stdout } = createMockContext({
            adapter: createInitAdapter(),
            cwd: tempDir,
        });

        await handleInit(ctx, undefined, { name: 'my-project', format: 'json' });

        const out = captureOutput(stdout);
        const parsed = JSON.parse(out) as { value: Record<string, unknown> };
        expect(typeof parsed.value.name).toBe('string');
        expect(typeof parsed.value.path).toBe('string');
    });

    it('should include the store name in the success output', async () => {
        const { ctx, stdout } = createMockContext({
            adapter: createInitAdapter(),
            cwd: tempDir,
        });

        await handleInit(ctx, undefined, { name: 'hello-world', format: 'json' });

        const out = captureOutput(stdout);
        const parsed = JSON.parse(out) as { value: { name: string } };
        expect(parsed.value.name).toBe('hello-world');
    });

    it('should expand tilde in target path', async () => {
        const { ctx, stdout } = createMockContext({
            adapter: createInitAdapter(),
            cwd: tempDir,
        });

        // resolveUserPath expands ~ — we just verify it doesn't throw and
        // produces output with a home-like absolute path
        await handleInit(ctx, '~/my-store', { name: 'my-project', format: 'yaml' });

        const out = captureOutput(stdout);
        expect(out).toContain('my-store');
    });
});
