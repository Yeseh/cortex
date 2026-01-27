import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { resolveStore } from './store.ts';

const access = mock(async (_path: string) => undefined);

mock.module('node:fs/promises', () => ({ access }));

describe('store resolution', () => {
    beforeEach(() => {
        access.mockReset();
    });

    it('should prefer a local store when available', async () => {
        access.mockResolvedValueOnce(undefined);

        const result = await resolveStore({
            cwd: '/work/project',
            globalStorePath: '/global/.cortex',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.root).toBe('/work/project/.cortex/memory');
            expect(result.value.scope).toBe('local');
        }
    });

    it('should fall back to the global store when local is missing', async () => {
        const missing = Object.assign(new Error('missing'), { code: 'ENOENT' });
        access.mockRejectedValueOnce(missing);
        access.mockResolvedValueOnce(undefined);

        const result = await resolveStore({
            cwd: '/work/missing',
            globalStorePath: '/global/.cortex',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.root).toBe('/global/.cortex');
            expect(result.value.scope).toBe('global');
        }
    });

    it('should resolve relative global paths against cwd', async () => {
        const missing = Object.assign(new Error('missing'), { code: 'ENOENT' });
        access.mockRejectedValueOnce(missing);
        access.mockResolvedValueOnce(undefined);

        const result = await resolveStore({
            cwd: '/work/missing',
            globalStorePath: 'stores/.cortex',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.root).toBe('/work/missing/stores/.cortex');
            expect(result.value.scope).toBe('global');
        }
    });

    it('should reject missing local store when strict_local is enabled', async () => {
        const missing = Object.assign(new Error('missing'), { code: 'ENOENT' });
        access.mockRejectedValueOnce(missing);

        const result = await resolveStore({
            cwd: '/work/missing',
            globalStorePath: '/global/.cortex',
            config: { strict_local: true },
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('LOCAL_STORE_MISSING');
            expect(result.error.path).toBe('/work/missing/.cortex/memory');
        }
    });

    it('should reject missing global store when local is absent', async () => {
        const missing = Object.assign(new Error('missing'), { code: 'ENOENT' });
        access.mockRejectedValueOnce(missing);
        access.mockRejectedValueOnce(missing);

        const result = await resolveStore({
            cwd: '/work/missing',
            globalStorePath: '/global/missing',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('GLOBAL_STORE_MISSING');
            expect(result.error.path).toBe('/global/missing');
        }
    });

    it('should surface access errors for stores', async () => {
        const failure = Object.assign(new Error('denied'), { code: 'EACCES' });
        access.mockRejectedValueOnce(failure);

        const result = await resolveStore({
            cwd: '/work/error',
            globalStorePath: '/global/.cortex',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('STORE_ACCESS_FAILED');
            expect(result.error.path).toBe('/work/error/.cortex/memory');
        }
    });
});
