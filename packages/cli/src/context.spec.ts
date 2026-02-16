import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { Cortex } from '@yeseh/cortex-core';

import {
    createCortexContext,
    getDefaultGlobalStorePath,
    resolveDefaultStoreName,
} from './context.ts';

describe('context', () => {
    describe('getDefaultGlobalStorePath', () => {
        it('should return path ending with .config/cortex/memory', () => {
            const path = getDefaultGlobalStorePath();
            expect(path.endsWith(join('.config', 'cortex', 'memory'))).toBe(true);
        });

        it('should use homedir as base', () => {
            const path = getDefaultGlobalStorePath();
            expect(path.startsWith(homedir())).toBe(true);
        });

        it('should return absolute path', () => {
            const path = getDefaultGlobalStorePath();
            expect(isAbsolute(path)).toBe(true);
        });

        it('should return consistent value on multiple calls', () => {
            const first = getDefaultGlobalStorePath();
            const second = getDefaultGlobalStorePath();
            expect(first).toBe(second);
        });
    });

    describe('createCortexContext', () => {
        let tempDir: string;
        let configDir: string;
        let cwdDir: string;

        beforeEach(async () => {
            tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-context-create-'));
            configDir = join(tempDir, 'config');
            cwdDir = join(tempDir, 'project');
            await fs.mkdir(configDir, { recursive: true });
            await fs.mkdir(cwdDir, { recursive: true });
        });

        afterEach(async () => {
            if (tempDir) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should create context from config and merge discovered local store', async () => {
            const storePath = join(tempDir, 'alpha-store');
            await fs.mkdir(storePath, { recursive: true });

            const localStorePath = join(cwdDir, '.cortex', 'memory');
            await fs.mkdir(localStorePath, { recursive: true });

            const escapedPath = storePath.replace(/'/g, "''");
            await fs.writeFile(
                join(configDir, 'config.yaml'),
                `settings:\n  output_format: json\nstores:\n  alpha:\n    path: '${escapedPath}'\n`
            );

            const stdout = new PassThrough();
            const stdin = new PassThrough();
            const now = new Date('2024-01-01T00:00:00.000Z');

            const result = await createCortexContext({
                configDir,
                cwd: cwdDir,
                stdout,
                stdin,
                now,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.cortex.registry.alpha?.path).toBe(storePath);
                expect(result.value.cortex.registry.local?.path).toBe(localStorePath);
                expect(result.value.cortex.settings.outputFormat).toBe('json');
                expect(result.value.stdout).toBe(stdout);
                expect(result.value.stdin).toBe(stdin);
                expect(result.value.now).toBe(now);
            }
        });

        it('should create context with discovered stores when config is missing', async () => {
            const localStorePath = join(cwdDir, '.cortex', 'memory');
            await fs.mkdir(localStorePath, { recursive: true });

            const result = await createCortexContext({
                configDir,
                cwd: cwdDir,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.cortex.registry.local?.path).toBe(localStorePath);
            }
        });

        it('should discover default store under provided configDir', async () => {
            const localStorePath = join(cwdDir, '.cortex', 'memory');
            const configGlobalStorePath = join(configDir, 'memory');
            await fs.mkdir(localStorePath, { recursive: true });
            await fs.mkdir(configGlobalStorePath, { recursive: true });

            const result = await createCortexContext({
                configDir,
                cwd: cwdDir,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.cortex.registry.local?.path).toBe(localStorePath);
                expect(result.value.cortex.registry.default?.path).toBe(configGlobalStorePath);
            }
        });

        it('should discover default store under home config when configDir is omitted', async () => {
            const originalHome = process.env.HOME;
            const originalUserProfile = process.env.USERPROFILE;
            const tempHome = join(tempDir, 'home');
            await fs.mkdir(tempHome, { recursive: true });
            process.env.HOME = tempHome;
            process.env.USERPROFILE = tempHome;

            try {
                const localStorePath = join(cwdDir, '.cortex', 'memory');
                await fs.mkdir(localStorePath, { recursive: true });

                const defaultStorePath = getDefaultGlobalStorePath();
                await fs.mkdir(defaultStorePath, { recursive: true });

                const result = await createCortexContext({
                    cwd: cwdDir,
                });

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    expect(result.value.cortex.registry.local?.path).toBe(localStorePath);
                    expect(result.value.cortex.registry.default?.path).toBe(defaultStorePath);
                }
            } finally {
                if (originalHome === undefined) {
                    delete process.env.HOME;
                } else {
                    process.env.HOME = originalHome;
                }
                if (originalUserProfile === undefined) {
                    delete process.env.USERPROFILE;
                } else {
                    process.env.USERPROFILE = originalUserProfile;
                }
            }
        });
    });

    describe('resolveDefaultStoreName', () => {
        it('should return explicit store name when provided', () => {
            const cortex = Cortex.init({
                rootDirectory: '/tmp',
                registry: {
                    local: { path: '/tmp/local' },
                    default: { path: '/tmp/default' },
                },
            });

            const result = resolveDefaultStoreName('custom', cortex);
            expect(result).toBe('custom');
        });

        it('should prefer local store when present', () => {
            const cortex = Cortex.init({
                rootDirectory: '/tmp',
                registry: {
                    local: { path: '/tmp/local' },
                    default: { path: '/tmp/default' },
                },
            });

            const result = resolveDefaultStoreName(undefined, cortex);
            expect(result).toBe('local');
        });

        it('should fall back to default when local store missing', () => {
            const cortex = Cortex.init({
                rootDirectory: '/tmp',
                registry: {
                    default: { path: '/tmp/default' },
                },
            });

            const result = resolveDefaultStoreName(undefined, cortex);
            expect(result).toBe('default');
        });
    });
});
