/**
 * Unit tests for the store prune command handler.
 *
 * @module cli/store/commands/prune.spec
 */

import { describe, it, expect } from 'bun:test';
import { handlePrune } from './prune.ts';
import {
    createMockContext,
    captureOutput,
    expectCommanderError,
    errResult,
    okResult,
} from '../../test-helpers.spec.ts';

describe('handlePrune', () => {
    it('should use default store when no store name is provided', async () => {
        const { ctx, stdout } = createMockContext();
        const calls: string[] = [];

        const root = {
            prune: async () => okResult({ pruned: [] }),
        };

        (ctx.cortex as unknown as { getStore: (name: string) => unknown }).getStore = (name: string) => {
            calls.push(name);
            return okResult({ root: () => okResult(root) });
        };

        await handlePrune(ctx, undefined, {}, { stdout });

        expect(calls).toEqual(['default']);
        expect(captureOutput(stdout)).toContain('No expired memories found.');
    });

    it('should output dry-run preview when --dry-run is enabled', async () => {
        const { ctx, stdout } = createMockContext();

        const root = {
            prune: async () =>
                okResult({
                    pruned: [{ path: 'project/old-memory' }, { path: 'notes/expired' }],
                }),
        };

        (ctx.cortex as unknown as { getStore: () => unknown }).getStore = () =>
            okResult({ root: () => okResult(root) });

        await handlePrune(ctx, 'work', { dryRun: true }, { stdout });

        const output = captureOutput(stdout);
        expect(output).toContain('Would prune 2 expired memories:');
        expect(output).toContain('project/old-memory');
        expect(output).toContain('notes/expired');
    });

    it('should output prune summary when dry-run is disabled', async () => {
        const { ctx, stdout } = createMockContext();

        const root = {
            prune: async () =>
                okResult({
                    pruned: [{ path: 'inbox/obsolete' }],
                }),
        };

        (ctx.cortex as unknown as { getStore: () => unknown }).getStore = () =>
            okResult({ root: () => okResult(root) });

        await handlePrune(ctx, 'work', { dryRun: false }, { stdout });

        const output = captureOutput(stdout);
        expect(output).toContain('Pruned 1 expired memories:');
        expect(output).toContain('inbox/obsolete');
    });

    it('should throw CommanderError when store resolution fails', async () => {
        const { ctx } = createMockContext();

        (ctx.cortex as unknown as { getStore: () => unknown }).getStore = () =>
            errResult({ code: 'STORE_NOT_FOUND', message: 'Store not found' });

        await expectCommanderError(
            () => handlePrune(ctx, 'missing', {}, {}),
            'STORE_NOT_FOUND',
            'Store not found',
        );
    });

    it('should throw CommanderError when root category cannot be loaded', async () => {
        const { ctx } = createMockContext();

        (ctx.cortex as unknown as { getStore: () => unknown }).getStore = () =>
            okResult({ root: () => errResult({ code: 'CATEGORY_NOT_FOUND', message: 'Root missing' }) });

        await expectCommanderError(
            () => handlePrune(ctx, 'default', {}, {}),
            'CATEGORY_NOT_FOUND',
            'Root missing',
        );
    });

    it('should throw CommanderError when prune operation fails', async () => {
        const { ctx } = createMockContext();

        const root = {
            prune: async () => errResult({ code: 'PRUNE_FAILED', message: 'Unable to prune' }),
        };

        (ctx.cortex as unknown as { getStore: () => unknown }).getStore = () =>
            okResult({ root: () => okResult(root) });

        await expectCommanderError(
            () => handlePrune(ctx, 'default', {}, {}),
            'PRUNE_FAILED',
            'Unable to prune',
        );
    });
});
