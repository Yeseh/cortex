/**
 * Unit tests for the store init command handler.
 *
 * @module cli/store/commands/init.spec
 */

import { describe, it, expect, afterEach, beforeEach, mock } from 'bun:test';
import { InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PromptDeps } from '../../utils/prompts.ts';

import { handleInit } from './init.ts';
import { createMockContext, captureOutput } from '../../test-helpers.spec.ts';
import { FilesystemConfigAdapter } from '@yeseh/cortex-storage-fs';

/**
 * Creates a real FilesystemConfigAdapter backed by a temp config file and
 * injects it into a mock context so handleInit can construct a real
 * FilesystemStorageAdapter without the adapter factory throwing STORE_NOT_FOUND.
 */
async function createInitContext(tempDir: string) {
    const configPath = join(tempDir, 'config.yaml');
    const configAdapter = new FilesystemConfigAdapter(configPath);
    await configAdapter.initializeConfig();

    const { ctx, stdout, stdin } = createMockContext({ cwd: tempDir });
    // Replace the mock ConfigAdapter with a real one so FilesystemStorageAdapter
    // construction inside handleInit works correctly.
    (ctx as unknown as Record<string, unknown>).config = configAdapter;

    return { ctx, stdout, stdin };
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
        const { ctx, stdout } = await createInitContext(tempDir);

        await handleInit(ctx, undefined, { name: 'my-project', format: 'yaml' });

        const out = captureOutput(stdout);
        expect(out).toContain('my-project');
    });

    it('should use the provided target path as the store path', async () => {
        const customPath = join(tempDir, 'custom-store');
        const { ctx, stdout } = await createInitContext(tempDir);

        await handleInit(ctx, customPath, { name: 'my-project', format: 'yaml' });

        const out = captureOutput(stdout);
        expect(out).toContain('custom-store');
    });

    it('should default to .cortex under cwd when no target path is given', async () => {
        const { ctx, stdout } = await createInitContext(tempDir);

        await handleInit(ctx, undefined, { name: 'my-project', format: 'yaml' });

        const out = captureOutput(stdout);
        // Default path is <cwd>/.cortex
        expect(out).toContain('.cortex');
    });

    it('should throw InvalidArgumentError for an invalid store name', async () => {
        const { ctx } = await createInitContext(tempDir);

        await expect(handleInit(ctx, undefined, { name: '   ', format: 'yaml' })).rejects.toThrow(
            InvalidArgumentError,
        );
    });

    it('should output in JSON format when format option is json', async () => {
        const { ctx, stdout } = await createInitContext(tempDir);

        await handleInit(ctx, undefined, { name: 'my-project', format: 'json' });

        const out = captureOutput(stdout);
        const parsed = JSON.parse(out) as { value: Record<string, unknown> };
        expect(typeof parsed.value.name).toBe('string');
        expect(typeof parsed.value.path).toBe('string');
    });

    it('should include the store name in the success output', async () => {
        const { ctx, stdout } = await createInitContext(tempDir);

        await handleInit(ctx, undefined, { name: 'hello-world', format: 'json' });

        const out = captureOutput(stdout);
        const parsed = JSON.parse(out) as { value: { name: string } };
        expect(parsed.value.name).toBe('hello-world');
    });

    it('should expand tilde in target path', async () => {
        const { ctx, stdout } = await createInitContext(tempDir);

        // resolveUserPath expands ~ — we just verify it doesn't throw and
        // produces output with a home-like absolute path
        await handleInit(ctx, '~/my-store', { name: 'my-project', format: 'yaml' });

        const out = captureOutput(stdout);
        expect(out).toContain('my-store');
    });

    it('should fail when the store name already exists', async () => {
        const { ctx } = await createInitContext(tempDir);
        const storePath = join(tempDir, '.cortex');

        await handleInit(ctx, storePath, { name: 'duplicate-store', format: 'yaml' });

        // Second init with the same name should throw
        const { ctx: ctx2 } = await createInitContext(tempDir);
        await expect(
            handleInit(ctx2, join(tempDir, '.cortex2'), { name: 'duplicate-store', format: 'yaml' }),
        ).rejects.toThrow();
    });
});

describe('handleInit - interactive mode', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-init-interactive-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should call promptDeps.input once (path only) when stdin is a TTY and --name is explicitly given', async () => {
        const inputMock = mock(
            async ({ default: d }: { message: string; default?: string }) => d ?? 'prompted-value',
        );
        const promptDeps: PromptDeps = { input: inputMock, confirm: mock(async () => true) };

        const { ctx, stdin } = await createInitContext(tempDir);
        (stdin as unknown as { isTTY: boolean }).isTTY = true;

        await handleInit(ctx, undefined, { name: 'my-project', format: 'yaml' }, promptDeps);

        // Should NOT call input when --name is explicitly given (skips name prompt but still prompts path)
        // With explicit name, only path prompt is called
        expect(inputMock).toHaveBeenCalledTimes(1);
    });

    it('should call promptDeps.input twice (name + path) when stdin is a TTY and no --name given', async () => {
        const inputMock = mock(
            async ({ default: d }: { message: string; default?: string }) => d ?? 'prompted-value',
        );
        const promptDeps: PromptDeps = { input: inputMock, confirm: mock(async () => true) };

        const { ctx, stdin } = await createInitContext(tempDir);
        (stdin as unknown as { isTTY: boolean }).isTTY = true;

        // No --name provided, should prompt for both name and path
        await handleInit(ctx, undefined, { format: 'yaml' }, promptDeps);

        expect(inputMock).toHaveBeenCalledTimes(2);
    });

    it('should NOT call promptDeps.input when stdin is NOT a TTY', async () => {
        const inputMock = mock(
            async ({ default: d }: { message: string; default?: string }) => d ?? 'prompted-value',
        );
        const promptDeps: PromptDeps = { input: inputMock, confirm: mock(async () => true) };

        const { ctx } = await createInitContext(tempDir);
        // ctx stdin has isTTY = undefined (non-TTY)

        await handleInit(ctx, undefined, { name: 'my-project', format: 'yaml' }, promptDeps);

        expect(inputMock).not.toHaveBeenCalled();
    });

    it('should skip both prompts when --name and target path are both given explicitly and TTY', async () => {
        const inputMock = mock(
            async ({ default: d }: { message: string; default?: string }) => d ?? 'prompted-value',
        );
        const promptDeps: PromptDeps = { input: inputMock, confirm: mock(async () => true) };

        const { ctx, stdin } = await createInitContext(tempDir);
        (stdin as unknown as { isTTY: boolean }).isTTY = true;
        const customPath = join(tempDir, 'custom-store');

        await handleInit(ctx, customPath, { name: 'my-project', format: 'yaml' }, promptDeps);

        expect(inputMock).not.toHaveBeenCalled();
    });

    it('should use prompted store name in the output', async () => {
        const promptedName = 'prompted-store-name';
        const inputMock = mock(
            async ({ message, default: d }: { message: string; default?: string }) => {
                if (message.toLowerCase().includes('name')) return promptedName;
                return d ?? 'default-path';
            },
        );
        const promptDeps: PromptDeps = { input: inputMock, confirm: mock(async () => true) };

        const { ctx, stdin, stdout } = await createInitContext(tempDir);
        (stdin as unknown as { isTTY: boolean }).isTTY = true;

        await handleInit(ctx, undefined, { format: 'json' }, promptDeps);

        const out = captureOutput(stdout);
        const parsed = JSON.parse(out) as { value: { name: string } };
        expect(parsed.value.name).toBe(promptedName);
    });
});
