import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
    getDefaultGlobalStorePath,
    getDefaultRegistryPath,
    loadRegistry,
    resolveStoreContext,
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
            expect(path.startsWith('/')).toBe(true);
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
            expect(path.startsWith('/')).toBe(true);
        });

        it('should return consistent value on multiple calls', () => {
            const first = getDefaultRegistryPath();
            const second = getDefaultRegistryPath();
            expect(first).toBe(second);
        });
    });

    describe('resolveStoreContext', () => {
        let tempDir: string;
        let localStoreDir: string;
        let globalStoreDir: string;
        let registryPath: string;

        beforeEach(async () => {
            tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-context-'));
            localStoreDir = join(tempDir, '.cortex', 'memory');
            globalStoreDir = join(tempDir, 'global-store');
            registryPath = join(tempDir, 'stores.yaml');
        });

        afterEach(async () => {
            if (tempDir) {
                await fs.rm(tempDir, { recursive: true, force: true });
            }
        });

        describe('without storeName (default resolution)', () => {
            it('should return local store context when .cortex/memory exists', async () => {
                await fs.mkdir(localStoreDir, { recursive: true });

                const result = await resolveStoreContext(undefined, {
                    cwd: tempDir,
                    globalStorePath: globalStoreDir,
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.root).toBe(localStoreDir);
                    expect(result.value.scope).toBe('local');
                    expect(result.value.name).toBeUndefined();
                }
            });

            it('should fall back to global store when local does not exist', async () => {
                await fs.mkdir(globalStoreDir, { recursive: true });

                const result = await resolveStoreContext(undefined, {
                    cwd: tempDir,
                    globalStorePath: globalStoreDir,
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.root).toBe(globalStoreDir);
                    expect(result.value.scope).toBe('global');
                    expect(result.value.name).toBeUndefined();
                }
            });

            it('should prefer local store over global store when both exist', async () => {
                await fs.mkdir(localStoreDir, { recursive: true });
                await fs.mkdir(globalStoreDir, { recursive: true });

                const result = await resolveStoreContext(undefined, {
                    cwd: tempDir,
                    globalStorePath: globalStoreDir,
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.root).toBe(localStoreDir);
                    expect(result.value.scope).toBe('local');
                }
            });

            it('should return error when neither local nor global store exists', async () => {
                const result = await resolveStoreContext(undefined, {
                    cwd: tempDir,
                    globalStorePath: globalStoreDir,
                });

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('STORE_RESOLUTION_FAILED');
                }
            });

            it('should use default cwd when not provided', async () => {
                // This test verifies the function works without explicit cwd
                // We need global store since we can't control process.cwd() local store
                const tempGlobal = join(tempDir, 'global-for-default');
                await fs.mkdir(tempGlobal, { recursive: true });

                const result = await resolveStoreContext(undefined, {
                    globalStorePath: tempGlobal,
                });

                // Result depends on whether process.cwd() has a local store
                // The important thing is it doesn't throw and returns a valid Result
                expect(result).toBeDefined();
                expect(typeof result.ok).toBe('boolean');
            });
        });

        describe('with storeName (registry resolution)', () => {
            it('should resolve store from registry', async () => {
                const storePathInRegistry = join(tempDir, 'registered-store');
                await fs.mkdir(storePathInRegistry, { recursive: true });
                await fs.writeFile(
                    registryPath,
                    `stores:\n  my-store:\n    path: "${storePathInRegistry}"\n`,
                );

                const result = await resolveStoreContext('my-store', {
                    cwd: tempDir,
                    registryPath,
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.root).toBe(storePathInRegistry);
                    expect(result.value.name).toBe('my-store');
                    expect(result.value.scope).toBe('registry');
                }
            });

            it('should return STORE_NOT_FOUND error when store not in registry', async () => {
                await fs.writeFile(
                    registryPath,
                    'stores:\n  other-store:\n    path: "/some/path"\n',
                );

                const result = await resolveStoreContext('nonexistent-store', {
                    cwd: tempDir,
                    registryPath,
                });

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('STORE_NOT_FOUND');
                    expect(result.error.message).toContain('nonexistent-store');
                }
            });

            it('should return REGISTRY_LOAD_FAILED error when registry file missing', async () => {
                const result = await resolveStoreContext('any-store', {
                    cwd: tempDir,
                    registryPath: join(tempDir, 'nonexistent-registry.yaml'),
                });

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('REGISTRY_LOAD_FAILED');
                }
            });

            it('should return REGISTRY_LOAD_FAILED error for invalid registry format', async () => {
                await fs.writeFile(registryPath, 'this is not valid yaml structure');

                const result = await resolveStoreContext('my-store', {
                    cwd: tempDir,
                    registryPath,
                });

                expect(result.ok).toBe(false);
                if (!result.ok) {
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
                    `stores:\n  first-store:\n    path: "${store1Path}"\n  second-store:\n    path: "${store2Path}"\n`,
                );

                const result1 = await resolveStoreContext('first-store', {
                    registryPath,
                });
                const result2 = await resolveStoreContext('second-store', {
                    registryPath,
                });

                expect(result1.ok).toBe(true);
                expect(result2.ok).toBe(true);
                if (result1.ok && result2.ok) {
                    expect(result1.value.root).toBe(store1Path);
                    expect(result2.value.root).toBe(store2Path);
                }
            });
        });

        describe('scope values', () => {
            it('should return scope "local" for local store', async () => {
                await fs.mkdir(localStoreDir, { recursive: true });

                const result = await resolveStoreContext(undefined, {
                    cwd: tempDir,
                    globalStorePath: globalStoreDir,
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.scope).toBe('local');
                }
            });

            it('should return scope "global" for global store', async () => {
                await fs.mkdir(globalStoreDir, { recursive: true });

                const result = await resolveStoreContext(undefined, {
                    cwd: tempDir,
                    globalStorePath: globalStoreDir,
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.scope).toBe('global');
                }
            });

            it('should return scope "registry" for registry store', async () => {
                const registryStorePath = join(tempDir, 'registry-store');
                await fs.mkdir(registryStorePath, { recursive: true });
                await fs.writeFile(
                    registryPath,
                    `stores:\n  reg-store:\n    path: "${registryStorePath}"\n`,
                );

                const result = await resolveStoreContext('reg-store', {
                    registryPath,
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.scope).toBe('registry');
                }
            });
        });

        describe('config integration', () => {
            it('should respect strict_local config when local store missing', async () => {
                const configDir = join(tempDir, '.cortex');
                await fs.mkdir(configDir, { recursive: true });
                await fs.writeFile(join(configDir, 'config.yaml'), 'strict_local: true\n');
                await fs.mkdir(globalStoreDir, { recursive: true });

                const result = await resolveStoreContext(undefined, {
                    cwd: tempDir,
                    globalStorePath: globalStoreDir,
                });

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('STORE_RESOLUTION_FAILED');
                }
            });

            it('should return CONFIG_LOAD_FAILED error when config is invalid', async () => {
                const configDir = join(tempDir, '.cortex');
                await fs.mkdir(configDir, { recursive: true });
                // Create an invalid YAML that will fail parsing
                await fs.writeFile(
                    join(configDir, 'config.yaml'),
                    'invalid: yaml: content: here\n  bad indentation',
                );

                const result = await resolveStoreContext(undefined, {
                    cwd: tempDir,
                    globalStorePath: globalStoreDir,
                });

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('CONFIG_LOAD_FAILED');
                }
            });
        });

        describe('edge cases', () => {
            it('should handle empty options object', async () => {
                const result = await resolveStoreContext(undefined, {});
                // Should not throw, result depends on actual system state
                expect(result).toBeDefined();
                expect(typeof result.ok).toBe('boolean');
            });

            it('should handle undefined options', async () => {
                const result = await resolveStoreContext(undefined);
                // Should not throw, result depends on actual system state
                expect(result).toBeDefined();
                expect(typeof result.ok).toBe('boolean');
            });

            it('should handle storeName with empty string as undefined', async () => {
                await fs.mkdir(localStoreDir, { recursive: true });

                // Empty string storeName should behave like undefined
                const result = await resolveStoreContext('', {
                    cwd: tempDir,
                    globalStorePath: globalStoreDir,
                });

                // Empty string is falsy, so should fall through to default resolution
                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.scope).toBe('local');
                }
            });
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
            await fs.writeFile(
                registryPath,
                `stores:\n  test-store:\n    path: "${storePath}"\n`,
            );

            const result = await loadRegistry(registryPath);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value['test-store']).toBeDefined();
                expect(result.value['test-store']?.path).toBe(storePath);
            }
        });

        it('should return empty registry for missing file (allowMissing is true by default)', async () => {
            const result = await loadRegistry(join(tempDir, 'nonexistent.yaml'));

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(Object.keys(result.value)).toHaveLength(0);
            }
        });

        it('should return error for invalid registry content', async () => {
            await fs.writeFile(registryPath, 'invalid: yaml: content: here\n  bad indentation');

            const result = await loadRegistry(registryPath);

            expect(result.ok).toBe(false);
            if (!result.ok) {
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

            expect(result.ok).toBe(true);
            if (result.ok) {
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

            expect(result.ok).toBe(true);
            if (result.ok) {
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
            expect(typeof result.ok).toBe('boolean');
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

            expect(result.ok).toBe(true);
            if (result.ok) {
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

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value['quoted-store']?.path).toBe('/path/with spaces/to/store');
            }
        });

        it('should return error when registry has no stores section', async () => {
            await fs.writeFile(registryPath, 'random: content\n');

            const result = await loadRegistry(registryPath);

            expect(result.ok).toBe(false);
            if (!result.ok) {
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

            expect(result.ok).toBe(false);
            if (!result.ok) {
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

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('REGISTRY_LOAD_FAILED');
            }
        });
    });
});
