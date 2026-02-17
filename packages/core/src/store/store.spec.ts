import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resolveStore } from './store.ts';

// Normalize paths for cross-platform comparison (convert backslashes and strip Windows drive letter)
const normalizePath = (p: string): string => p.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '');

describe('store resolution', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-store-test-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should prefer a local store when available', async () => {
        // Create local store directory
        const localStore = join(tempDir, 'project', '.cortex', 'memory');
        await mkdir(localStore, { recursive: true });

        const result = await resolveStore({
            cwd: join(tempDir, 'project'),
            globalStorePath: join(tempDir, 'global'),
        });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(normalizePath(result.value.root)).toBe(normalizePath(localStore));
            expect(result.value.scope).toBe('local');
        }
    });

    it('should fall back to the global store when local is missing', async () => {
        // Create only global store directory
        const globalStore = join(tempDir, 'global');
        await mkdir(globalStore, { recursive: true });

        const result = await resolveStore({
            cwd: join(tempDir, 'missing'),
            globalStorePath: globalStore,
        });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(normalizePath(result.value.root)).toBe(normalizePath(globalStore));
            expect(result.value.scope).toBe('global');
        }
    });

    it('should resolve relative global paths against cwd', async () => {
        // Create global store at relative path
        const cwd = join(tempDir, 'work');
        const globalStore = join(cwd, 'stores', '.cortex');
        await mkdir(globalStore, { recursive: true });

        const result = await resolveStore({
            cwd,
            globalStorePath: 'stores/.cortex',
        });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(normalizePath(result.value.root)).toBe(normalizePath(globalStore));
            expect(result.value.scope).toBe('global');
        }
    });

    it('should reject missing local store when strictLocal is enabled', async () => {
        // Create only global store
        const globalStore = join(tempDir, 'global');
        await mkdir(globalStore, { recursive: true });

        const cwd = join(tempDir, 'missing');
        const result = await resolveStore({
            cwd,
            globalStorePath: globalStore,
            config: { strictLocal: true },
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('LOCAL_STORE_MISSING');
            expect(normalizePath(result.error.path!)).toBe(
                normalizePath(join(cwd, '.cortex', 'memory')),
            );
        }
    });

    it('should reject missing global store when local is absent', async () => {
        // Don't create any stores
        const cwd = join(tempDir, 'missing');
        const globalStore = join(tempDir, 'global', 'missing');

        const result = await resolveStore({
            cwd,
            globalStorePath: globalStore,
        });

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('GLOBAL_STORE_MISSING');
            expect(normalizePath(result.error.path!)).toBe(normalizePath(globalStore));
        }
    });

    // Note: Testing EACCES (permission denied) is platform-specific and unreliable
    // in temp directories, so we skip that test case. The error handling code path
    // is still covered by the implementation.
});
