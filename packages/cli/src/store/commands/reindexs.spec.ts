/**
 * Unit tests for the store reindex command handler.
 *
 * @module cli/store/commands/reindexs.spec
 */

import { describe, it, expect } from 'bun:test';
import { handleReindex } from './reindexs.ts';
import {
    createMockContext,
    captureOutput,
    expectCommanderError,
    errResult,
    okResult,
} from '../../test-helpers.spec.ts';

describe('handleReindex', () => {
    it('should use default store when no store name is provided', async () => {
        const { ctx, stdout } = createMockContext();
        const calls: string[] = [];

        const root = {
            reindex: async () => okResult({ warnings: [] }),
        };

        (ctx.cortex as unknown as { getStore: (name: string) => unknown }).getStore = (name: string) => {
            calls.push(name);
            return okResult({ root: () => okResult(root) });
        };

        await handleReindex(ctx, undefined, { stdout });

        expect(calls).toEqual(['default']);
        expect(captureOutput(stdout)).toContain("Reindexed category indexes for store 'default'.");
    });

    it('should output success message for an explicit store', async () => {
        const { ctx, stdout } = createMockContext();

        const root = {
            reindex: async () => okResult({ warnings: [] }),
        };

        (ctx.cortex as unknown as { getStore: () => unknown }).getStore = () =>
            okResult({ root: () => okResult(root) });

        await handleReindex(ctx, 'work', { stdout });

        expect(captureOutput(stdout)).toContain("Reindexed category indexes for store 'work'.");
    });

    it('should throw CommanderError when store resolution fails', async () => {
        const { ctx } = createMockContext();

        (ctx.cortex as unknown as { getStore: () => unknown }).getStore = () =>
            errResult({ code: 'STORE_NOT_FOUND', message: 'Store not found' });

        await expectCommanderError(
            () => handleReindex(ctx, 'missing'),
            'STORE_NOT_FOUND',
            'Store not found',
        );
    });

    it('should throw CommanderError when root category cannot be loaded', async () => {
        const { ctx } = createMockContext();

        (ctx.cortex as unknown as { getStore: () => unknown }).getStore = () =>
            okResult({ root: () => errResult({ code: 'CATEGORY_NOT_FOUND', message: 'Root missing' }) });

        await expectCommanderError(
            () => handleReindex(ctx, 'default'),
            'CATEGORY_NOT_FOUND',
            'Root missing',
        );
    });

    it('should map reindex failures to REINDEX_FAILED', async () => {
        const { ctx } = createMockContext();

        const root = {
            reindex: async () => errResult({ code: 'INDEX_WRITE_FAILED', message: 'Index write failed' }),
        };

        (ctx.cortex as unknown as { getStore: () => unknown }).getStore = () =>
            okResult({ root: () => okResult(root) });

        await expectCommanderError(
            () => handleReindex(ctx, 'default'),
            'REINDEX_FAILED',
            'Index write failed',
        );
    });
});
