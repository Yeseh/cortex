import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { Cortex } from '@yeseh/cortex-core';

import {
    createCortexContext,
    getDefaultGlobalStorePath,
    getDefaultRegistryPath,
    loadRegistry,
    resolveDefaultStoreName,
    resolveStorePathFromRegistry,
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

    describe('getDefaultRegistryPath', () => {
        it('should return path ending with .config/cortex/stores.yaml', () => {
            const path = getDefaultRegistryPath();
            expect(path.endsWith(join('.config', 'cortex', 'stores.yaml'))).toBe(true);
        });

        it('should use homedir as base', () => {
            const path = getDefaultRegistryPath();
            expect(path.startsWith(homedir())).toBe(true);
        });

        it('should return absolute path', () => {
            const path = getDefaultRegistryPath();
            expect(isAbsolute(path)).toBe(true);
        });

        it('should return consistent value on multiple calls', () => {
            const first = getDefaultRegistryPath();
            const second = getDefaultRegistryPath();
            expect(first).toBe(second);
        });
    });

    describe('resolveStorePathFromRegistry', () => {
        let tempDir: string;
        let registryPath: string;

        beforeEach(async () => {
            tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-context-'));
            registryPath = join(tempDir, 'stores.yaml');
        });

        afterEach(async () => {
            if (tempDir) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should resolve store path from registry', async () => {
            const storePathInRegistry = join(tempDir, 'registered-store');
            await fs.mkdir(storePathInRegistry, { recursive: true });
            await fs.writeFile(
                registryPath,
                `stores:\n  my-store:\n    path: '${storePathInRegistry}'\n`,
            );

            const result = await resolveStorePathFromRegistry('my-store', registryPath);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe(storePathInRegistry);
            }
        });

        it('should return STORE_NOT_FOUND error when store not in registry', async () => {
            await fs.writeFile(
                registryPath,
                'stores:\n  other-store:\n    path: "/some/path"\n',
            );

            const result = await resolveStorePathFromRegistry('nonexistent-store', registryPath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORE_NOT_FOUND');
                expect(result.error.message).toContain('nonexistent-store');
            }
        });

        it('should return REGISTRY_LOAD_FAILED error when registry file missing', async () => {
            const result = await resolveStorePathFromRegistry(
                'any-store',
                join(tempDir, 'nonexistent-registry.yaml'),
            );

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('REGISTRY_LOAD_FAILED');
            }
        });

        it('should return REGISTRY_LOAD_FAILED error for invalid registry format', async () => {
            await fs.writeFile(registryPath, 'this is not valid yaml structure');

            const result = await resolveStorePathFromRegistry('my-store', registryPath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('REGISTRY_LOAD_FAILED');
            }
        });

        it('should handle multiple stores in registry', async () => {
            const store1Path = join(tempDir, 'store-1');
            const store2Path = join(tempDir, 'store-2');
            await fs.mkdir(store1Path, { recursive: true });
            await fs.mkdir(store2Path, { recursive: true });
            await fs.writeFile(
                registryPath,
                `stores:\n  first-store:\n    path: '${store1Path}'\n  second-store:\n    path: '${store2Path}'\n`,
            );

            const result1 = await resolveStorePathFromRegistry('first-store', registryPath);
            const result2 = await resolveStorePathFromRegistry('second-store', registryPath);

            expect(result1.ok()).toBe(true);
            expect(result2.ok()).toBe(true);
            if (result1.ok() && result2.ok()) {
                expect(result1.value).toBe(store1Path);
                expect(result2.value).toBe(store2Path);
            }
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
                `settings:\n  output_format: json\nstores:\n  alpha:\n    path: '${escapedPath}'\n`,
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

    describe('loadRegistry', () => {
        let tempDir: string;
        let registryPath: string;

        beforeEach(async () => {
            tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-registry-'));
            registryPath = join(tempDir, 'stores.yaml');
        });

        afterEach(async () => {
            if (tempDir) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        it('should load valid registry file', async () => {
            const storePath = join(tempDir, 'my-store');
            await fs.writeFile(registryPath, `stores:\n  test-store:\n    path: "${storePath}"\n`);

            const result = await loadRegistry(registryPath);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value['test-store']).toBeDefined();
                expect(result.value['test-store']?.path).toBe(storePath);
            }
        });

        it('should return empty registry for missing file (allowMissing is true by default)', async () => {
            const result = await loadRegistry(join(tempDir, 'nonexistent.yaml'));

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(Object.keys(result.value)).toHaveLength(0);
            }
        });

        it('should return error for invalid registry content', async () => {
            await fs.writeFile(registryPath, 'invalid: yaml: content: here\n  bad indentation');

            const result = await loadRegistry(registryPath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('REGISTRY_LOAD_FAILED');
            }
        });

        it('should load registry with multiple stores', async () => {
            await fs.writeFile(
                registryPath,
                `stores:
  alpha-store:
    path: "/path/to/alpha"
  beta-store:
    path: "/path/to/beta"
  gamma-store:
    path: "/path/to/gamma"
`,
            );

            const result = await loadRegistry(registryPath);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(Object.keys(result.value)).toHaveLength(3);
                expect(result.value['alpha-store']?.path).toBe('/path/to/alpha');
                expect(result.value['beta-store']?.path).toBe('/path/to/beta');
                expect(result.value['gamma-store']?.path).toBe('/path/to/gamma');
            }
        });

        it('should load registry with descriptions', async () => {
            await fs.writeFile(
                registryPath,
                `stores:
  described-store:
    path: "/path/to/store"
    description: "A store with a description"
`,
            );

            const result = await loadRegistry(registryPath);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value['described-store']?.description).toBe(
                    'A store with a description',
                );
            }
        });

        it('should use default registry path when not provided', async () => {
            const result = await loadRegistry();

            // Result depends on whether default registry exists
            // The important thing is it doesn't throw and returns a Result
            expect(result).toBeDefined();
            expect(typeof result.ok).toBe('function');
        });

        it('should handle registry with comments', async () => {
            await fs.writeFile(
                registryPath,
                `# This is a comment
stores:
  # Another comment
  commented-store:
    path: "/path/to/store"  # inline comment
`,
            );

            const result = await loadRegistry(registryPath);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value['commented-store']?.path).toBe('/path/to/store');
            }
        });

        it('should handle registry with quoted paths', async () => {
            await fs.writeFile(
                registryPath,
                `stores:
  quoted-store:
    path: "/path/with spaces/to/store"
`,
            );

            const result = await loadRegistry(registryPath);

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value['quoted-store']?.path).toBe('/path/with spaces/to/store');
            }
        });

        it('should return error when registry has no stores section', async () => {
            await fs.writeFile(registryPath, 'random: content\n');

            const result = await loadRegistry(registryPath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('REGISTRY_LOAD_FAILED');
            }
        });

        it('should return error for store without path', async () => {
            await fs.writeFile(
                registryPath,
                `stores:
  missing-path-store:
    description: "Has no path"
`,
            );

            const result = await loadRegistry(registryPath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('REGISTRY_LOAD_FAILED');
            }
        });

        it('should return error for invalid store name', async () => {
            await fs.writeFile(
                registryPath,
                `stores:
  Invalid_Store_Name:
    path: "/some/path"
`,
            );

            const result = await loadRegistry(registryPath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('REGISTRY_LOAD_FAILED');
            }
        });
    });
});
