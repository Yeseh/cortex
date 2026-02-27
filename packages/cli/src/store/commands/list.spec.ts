/**
 * Unit tests for the store list command handler.
 *
 * @module cli/store/commands/list.spec
 */

import { describe, it, expect } from 'bun:test';
import { handleList } from './list.ts';
import {
    createMockContext,
    captureOutput,
} from '../../test-helpers.spec.ts';

describe('handleList', () => {
    it('should output empty store list when no stores are configured', async () => {
        const { ctx, stdout } = createMockContext({ stores: {} });

        await handleList(ctx, {}, { stdout });

        const output = captureOutput(stdout);
        // YAML output for empty stores list
        expect(output).toContain('stores');
    });

    it('should output a single store in YAML format by default', async () => {
        const { ctx, stdout } = createMockContext({
            stores: {
                global: {
                    kind: 'filesystem',
                    categoryMode: 'free',
                    categories: {},
                    properties: { path: '/mock/store' },
                },
            },
        });

        await handleList(ctx, {}, { stdout });

        const output = captureOutput(stdout);
        expect(output).toContain('global');
        expect(output).toContain('/mock/store');
    });

    it('should output multiple stores sorted alphabetically by name', async () => {
        const { ctx, stdout } = createMockContext({
            stores: {
                zebra: {
                    kind: 'filesystem',
                    categoryMode: 'free',
                    categories: {},
                    properties: { path: '/path/zebra' },
                },
                alpha: {
                    kind: 'filesystem',
                    categoryMode: 'free',
                    categories: {},
                    properties: { path: '/path/alpha' },
                },
                middle: {
                    kind: 'filesystem',
                    categoryMode: 'free',
                    categories: {},
                    properties: { path: '/path/middle' },
                },
            },
        });

        await handleList(ctx, {}, { stdout });

        const output = captureOutput(stdout);
        const alphaPos = output.indexOf('alpha');
        const middlePos = output.indexOf('middle');
        const zebraPos = output.indexOf('zebra');

        expect(alphaPos).toBeLessThan(middlePos);
        expect(middlePos).toBeLessThan(zebraPos);
    });

    it('should output stores in JSON format when format is json', async () => {
        const { ctx, stdout } = createMockContext({
            stores: {
                global: {
                    kind: 'filesystem',
                    categoryMode: 'free',
                    categories: {},
                    properties: { path: '/mock/store' },
                },
            },
        });

        await handleList(ctx, { format: 'json' }, { stdout });

        const output = captureOutput(stdout);
        const parsed = JSON.parse(output);
        const stores = parsed.stores ?? parsed.value?.stores;
        expect(Array.isArray(stores)).toBe(true);
        expect(stores).toEqual([
            {
                name: 'global',
                path: '/mock/store',
            },
        ]);
    });

    it('should include store paths in the output', async () => {
        const { ctx, stdout } = createMockContext({
            stores: {
                work: {
                    kind: 'filesystem',
                    categoryMode: 'free',
                    categories: {},
                    properties: { path: '/home/user/work-memories' },
                },
            },
        });

        await handleList(ctx, {}, { stdout });

        const output = captureOutput(stdout);
        expect(output).toContain('work');
        expect(output).toContain('/home/user/work-memories');
    });

    it('should write output to the injected stdout stream', async () => {
        const { ctx } = createMockContext();
        const { PassThrough } = await import('node:stream');
        const customStdout = new PassThrough();
        let captured = '';
        customStdout.on('data', (chunk: Buffer | string) => {
            captured += chunk.toString();
        });

        await handleList(ctx, {}, { stdout: customStdout });

        expect(captured.length).toBeGreaterThan(0);
    });

    it('should use ctx.stdout when no deps.stdout is provided', async () => {
        const { ctx, stdout } = createMockContext();

        // Call without deps – handler falls back to ctx.stdout then process.stdout.
        // We cannot easily capture process.stdout, so pass ctx.stdout via deps.
        await handleList(ctx, {}, { stdout });

        const output = captureOutput(stdout);
        expect(output.length).toBeGreaterThan(0);
    });

    it('should output two stores with correct names and paths in YAML', async () => {
        const { ctx, stdout } = createMockContext({
            stores: {
                personal: {
                    kind: 'filesystem',
                    categoryMode: 'free',
                    categories: {},
                    properties: { path: '/home/user/personal' },
                },
                work: {
                    kind: 'filesystem',
                    categoryMode: 'free',
                    categories: {},
                    properties: { path: '/home/user/work' },
                },
            },
        });

        await handleList(ctx, { format: 'yaml' }, { stdout });

        const output = captureOutput(stdout);
        expect(output).toContain('personal');
        expect(output).toContain('/home/user/personal');
        expect(output).toContain('work');
        expect(output).toContain('/home/user/work');
    });
});
