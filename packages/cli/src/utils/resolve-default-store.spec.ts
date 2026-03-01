/**
 * Tests for resolveDefaultStore utility.
 *
 * @module cli/utils/resolve-default-store.spec
 */

import { describe, it, expect } from 'bun:test';
import { resolveDefaultStore } from './resolve-default-store.ts';
import type { CortexContext } from '@yeseh/cortex-core';

// Minimal mock context factory
function makeCtx(
    overrides: {
        cwd?: string;
        stores?: Record<string, { properties?: Record<string, unknown> }>;
        defaultStore?: string;
    } = {}
): CortexContext {
    return {
        cwd: overrides.cwd ?? '/home/user/myproject',
        stores: (overrides.stores ?? {}) as CortexContext['stores'],
        settings: { defaultStore: overrides.defaultStore },
        cortex: {} as CortexContext['cortex'],
        config: {} as CortexContext['config'],
        now: () => new Date(),
        stdin: process.stdin,
        stdout: process.stdout,
    };
}

describe('resolveDefaultStore', () => {
    it('should return explicit store when provided', () => {
        const ctx = makeCtx({ stores: { mystore: { properties: { path: '/some/path' } } } });
        expect(resolveDefaultStore(ctx, 'mystore')).toBe('mystore');
    });

    it('should return explicit store even when a local store exists', () => {
        const ctx = makeCtx({
            cwd: '/home/user/myproject',
            stores: {
                local: { properties: { path: '/home/user/myproject/.cortex' } },
            },
        });
        expect(resolveDefaultStore(ctx, 'explicit')).toBe('explicit');
    });

    it('should auto-detect local store whose path matches <cwd>/.cortex', () => {
        const ctx = makeCtx({
            cwd: '/home/user/myproject',
            stores: {
                global: { properties: { path: '/home/user/.config/cortex/memory' } },
                myproject: { properties: { path: '/home/user/myproject/.cortex' } },
            },
        });
        expect(resolveDefaultStore(ctx, undefined)).toBe('myproject');
    });

    it('should auto-detect local store whose path matches <cwd>/.cortex/memory', () => {
        const ctx = makeCtx({
            cwd: '/home/user/myproject',
            stores: {
                global: { properties: { path: '/home/user/.config/cortex/memory' } },
                myproject: { properties: { path: '/home/user/myproject/.cortex/memory' } },
            },
        });
        expect(resolveDefaultStore(ctx, undefined)).toBe('myproject');
    });

    it('should not match a store whose path only starts with cwd (not an exact .cortex path)', () => {
        // e.g. cwd is /home/user/proj and a store has /home/user/proj-other/.cortex
        const ctx = makeCtx({
            cwd: '/home/user/proj',
            stores: {
                other: { properties: { path: '/home/user/proj-other/.cortex' } },
                global: { properties: { path: '/home/user/.config/cortex/memory' } },
            },
            defaultStore: 'global',
        });
        expect(resolveDefaultStore(ctx, undefined)).toBe('global');
    });

    it('should fall back to settings.defaultStore when no local store matches', () => {
        const ctx = makeCtx({
            cwd: '/home/user/myproject',
            stores: {
                custom: { properties: { path: '/data/custom' } },
            },
            defaultStore: 'custom',
        });
        expect(resolveDefaultStore(ctx, undefined)).toBe('custom');
    });

    it('should fall back to "global" when no local store and no defaultStore', () => {
        const ctx = makeCtx({
            cwd: '/home/user/myproject',
            stores: {
                other: { properties: { path: '/data/other' } },
            },
        });
        expect(resolveDefaultStore(ctx, undefined)).toBe('global');
    });

    it('should fall back to "global" when stores is empty', () => {
        const ctx = makeCtx({ cwd: '/home/user/myproject', stores: {} });
        expect(resolveDefaultStore(ctx, undefined)).toBe('global');
    });

    it('should handle stores with missing properties gracefully', () => {
        const ctx = makeCtx({
            cwd: '/home/user/myproject',
            stores: {
                broken: {} as { properties?: Record<string, unknown> },
            },
        });
        expect(resolveDefaultStore(ctx, undefined)).toBe('global');
    });

    it('should use process.cwd() when ctx.cwd is not set', () => {
        // Build a ctx with no cwd — store path matches process.cwd()
        const cwd = process.cwd();
        const ctx = {
            stores: {
                local: { properties: { path: `${cwd}/.cortex` } },
            } as unknown as CortexContext['stores'],
            settings: {},
            cortex: {} as CortexContext['cortex'],
            config: {} as CortexContext['config'],
            now: () => new Date(),
            stdin: process.stdin,
            stdout: process.stdout,
            // cwd intentionally omitted
        } as CortexContext;
        expect(resolveDefaultStore(ctx, undefined)).toBe('local');
    });
});
