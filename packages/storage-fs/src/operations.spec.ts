import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FilesystemRegistry } from './index.ts';
import { initializeStore } from '@yeseh/cortex-core/store';

describe('initializeStore', () => {
    let tempDir: string;
    let registryPath: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-store-operations-'));
        registryPath = join(tempDir, 'stores.yaml');
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('successful store creation', () => {
        it('should create store with valid name', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'my-store');

            const result = await initializeStore(registry, 'my-store', storePath);

            expect(result.ok()).toBe(true);

            // Verify store directory was created
            const stat = await fs.stat(storePath);
            expect(stat.isDirectory()).toBe(true);

            // Verify root index.yaml was created
            const indexContent = await fs.readFile(join(storePath, 'index.yaml'), 'utf8');
            expect(indexContent).toContain('memories:');
            expect(indexContent).toContain('subcategories:');
        });

        it('should create store with categories', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'categorized-store');

            const result = await initializeStore(registry, 'categorized-store', storePath, {
                categories: [
                    'global', 'projects',
                ],
            });

            expect(result.ok()).toBe(true);

            // Verify category directories were created
            const globalStat = await fs.stat(join(storePath, 'global'));
            expect(globalStat.isDirectory()).toBe(true);

            const projectsStat = await fs.stat(join(storePath, 'projects'));
            expect(projectsStat.isDirectory()).toBe(true);

            // Verify category index files were created
            const globalIndex = await fs.readFile(join(storePath, 'global', 'index.yaml'), 'utf8');
            expect(globalIndex).toContain('memories:');
            expect(globalIndex).toContain('subcategories:');

            const projectsIndex = await fs.readFile(
                join(storePath, 'projects', 'index.yaml'),
                'utf8',
            );
            expect(projectsIndex).toContain('memories:');
            expect(projectsIndex).toContain('subcategories:');
        });

        it('should create root index with subcategories listed', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'indexed-store');

            await initializeStore(registry, 'indexed-store', storePath, {
                categories: [
                    'alpha', 'beta',
                ],
            });

            const rootIndex = await fs.readFile(join(storePath, 'index.yaml'), 'utf8');
            expect(rootIndex).toContain('alpha');
            expect(rootIndex).toContain('beta');
            // Subcategories should have memory_count: 0
            expect(rootIndex).toContain('memory_count: 0');
        });

        it('should register store in registry after creation', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'registered-store');

            await initializeStore(registry, 'registered-store', storePath);

            // Reload registry and verify store is registered
            const loadResult = await registry.load();
            expect(loadResult.ok()).toBe(true);
            if (loadResult.ok()) {
                expect(loadResult.value['registered-store']).toBeDefined();
                expect(loadResult.value['registered-store']?.path).toBe(storePath);
            }
        });

        it('should register store with description when provided', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'described-store');

            await initializeStore(registry, 'described-store', storePath, {
                description: 'A test store with description',
            });

            const loadResult = await registry.load();
            expect(loadResult.ok()).toBe(true);
            if (loadResult.ok()) {
                expect(loadResult.value['described-store']?.description).toBe(
                    'A test store with description',
                );
            }
        });

        it('should work when registry does not exist yet', async () => {
            const newRegistryPath = join(tempDir, 'new-dir', 'stores.yaml');
            const registry = new FilesystemRegistry(newRegistryPath);
            const storePath = join(tempDir, 'fresh-store');

            const result = await initializeStore(registry, 'fresh-store', storePath);

            expect(result.ok()).toBe(true);

            // Verify registry file was created
            const registryExists = await fs
                .stat(newRegistryPath)
                .then(() => true)
                .catch(() => false);
            expect(registryExists).toBe(true);

            // Verify store is in registry
            const loadResult = await registry.load();
            expect(loadResult.ok()).toBe(true);
            if (loadResult.ok()) {
                expect(loadResult.value['fresh-store']).toBeDefined();
            }
        });

        it('should handle single-segment store names', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'simple');

            const result = await initializeStore(registry, 'simple', storePath);

            expect(result.ok()).toBe(true);
        });

        it('should handle store names with numbers', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'project123');

            const result = await initializeStore(registry, 'project123', storePath);

            expect(result.ok()).toBe(true);
        });

        it('should handle store names with hyphens', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'my-project-v2');

            const result = await initializeStore(registry, 'my-project-v2', storePath);

            expect(result.ok()).toBe(true);
        });

        it('should create store with empty categories array', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'empty-cats');

            const result = await initializeStore(registry, 'empty-cats', storePath, {
                categories: [],
            });

            expect(result.ok()).toBe(true);

            // Only root index should exist
            const rootIndex = await fs.readFile(join(storePath, 'index.yaml'), 'utf8');
            expect(rootIndex).toContain('subcategories: []');
        });
    });

    describe('invalid store name', () => {
        it('should return INVALID_STORE_NAME for uppercase letters', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'upper');

            const result = await initializeStore(registry, 'MyStore', storePath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
                expect(result.error.store).toBe('MyStore');
            }
        });

        it('should return INVALID_STORE_NAME for spaces', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'spaces');

            const result = await initializeStore(registry, 'my store', storePath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        it('should return INVALID_STORE_NAME for special characters', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'special');

            const result = await initializeStore(registry, 'my_store!', storePath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        it('should return INVALID_STORE_NAME for underscores', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'underscore');

            const result = await initializeStore(registry, 'my_store', storePath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        it('should return INVALID_STORE_NAME for empty string', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'empty');

            const result = await initializeStore(registry, '', storePath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        it('should return INVALID_STORE_NAME for leading hyphen', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'leading');

            const result = await initializeStore(registry, '-store', storePath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        it('should return INVALID_STORE_NAME for trailing hyphen', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'trailing');

            const result = await initializeStore(registry, 'store-', storePath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        it('should return INVALID_STORE_NAME for consecutive hyphens', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'consecutive');

            const result = await initializeStore(registry, 'my--store', storePath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });
    });

    describe('store already exists', () => {
        it('should return STORE_ALREADY_EXISTS when store is already registered', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath1 = join(tempDir, 'existing-store');
            const storePath2 = join(tempDir, 'new-path');

            // Create the first store
            const firstResult = await initializeStore(registry, 'existing-store', storePath1);
            expect(firstResult.ok()).toBe(true);

            // Try to create a store with the same name
            const secondResult = await initializeStore(registry, 'existing-store', storePath2);

            expect(secondResult.ok()).toBe(false);
            if (!secondResult.ok()) {
                expect(secondResult.error.code).toBe('STORE_ALREADY_EXISTS');
                expect(secondResult.error.store).toBe('existing-store');
                expect(secondResult.error.message).toContain('already registered');
            }
        });

        it('should detect collision with pre-existing registry entry', async () => {
            // Pre-create a registry with an existing store
            const existingRegistry = 'pre-existing:\n  path: /some/path';
            await fs.writeFile(registryPath, existingRegistry);

            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'new-store');

            const result = await initializeStore(registry, 'pre-existing', storePath);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORE_ALREADY_EXISTS');
            }
        });
    });

    describe('filesystem operations', () => {
        it('should create nested directories for store path', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const nestedPath = join(tempDir, 'deep', 'nested', 'store');

            const result = await initializeStore(registry, 'nested-store', nestedPath);

            expect(result.ok()).toBe(true);

            const stat = await fs.stat(nestedPath);
            expect(stat.isDirectory()).toBe(true);
        });

        it('should handle store creation in existing directory', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'pre-existing-dir');

            // Create the directory first
            await fs.mkdir(storePath, { recursive: true });

            const result = await initializeStore(registry, 'pre-existing-dir', storePath);

            expect(result.ok()).toBe(true);

            // Verify index was created
            const indexContent = await fs.readFile(join(storePath, 'index.yaml'), 'utf8');
            expect(indexContent).toContain('memories:');
        });
    });

    describe('multiple stores', () => {
        it('should allow creating multiple different stores', async () => {
            const registry = new FilesystemRegistry(registryPath);

            const store1Path = join(tempDir, 'store1');
            const store2Path = join(tempDir, 'store2');
            const store3Path = join(tempDir, 'store3');

            const result1 = await initializeStore(registry, 'store1', store1Path);
            const result2 = await initializeStore(registry, 'store2', store2Path);
            const result3 = await initializeStore(registry, 'store3', store3Path);

            expect(result1.ok()).toBe(true);
            expect(result2.ok()).toBe(true);
            expect(result3.ok()).toBe(true);

            // Verify all stores are in registry
            const loadResult = await registry.load();
            expect(loadResult.ok()).toBe(true);
            if (loadResult.ok()) {
                expect(Object.keys(loadResult.value)).toHaveLength(3);
                expect(loadResult.value['store1']).toBeDefined();
                expect(loadResult.value['store2']).toBeDefined();
                expect(loadResult.value['store3']).toBeDefined();
            }
        });

        it('should preserve existing stores when adding new one', async () => {
            // Pre-create a registry with an existing store
            const existingRegistry = 'existing:\n  path: /existing/path';
            await fs.writeFile(registryPath, existingRegistry);

            const registry = new FilesystemRegistry(registryPath);
            const newStorePath = join(tempDir, 'new-store');

            const result = await initializeStore(registry, 'new-store', newStorePath);

            expect(result.ok()).toBe(true);

            // Verify both stores are in registry
            const loadResult = await registry.load();
            expect(loadResult.ok()).toBe(true);
            if (loadResult.ok()) {
                expect(loadResult.value['existing']).toBeDefined();
                expect(loadResult.value['existing']?.path).toBe('/existing/path');
                expect(loadResult.value['new-store']).toBeDefined();
                expect(loadResult.value['new-store']?.path).toBe(newStorePath);
            }
        });
    });

    describe('index file content', () => {
        it('should create valid YAML index files', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'yaml-store');

            await initializeStore(registry, 'yaml-store', storePath, {
                categories: ['test-category'],
            });

            // Root index should have subcategory reference
            const rootIndex = await fs.readFile(join(storePath, 'index.yaml'), 'utf8');
            expect(rootIndex).toContain('path: test-category');
            expect(rootIndex).toContain('memory_count: 0');

            // Category index should be empty
            const categoryIndex = await fs.readFile(
                join(storePath, 'test-category', 'index.yaml'),
                'utf8',
            );
            expect(categoryIndex).toContain('memories: []');
            expect(categoryIndex).toContain('subcategories: []');
        });

        it('should create index with multiple subcategories in order', async () => {
            const registry = new FilesystemRegistry(registryPath);
            const storePath = join(tempDir, 'multi-cat-store');

            await initializeStore(registry, 'multi-cat-store', storePath, {
                categories: [
                    'alpha',
                    'beta',
                    'gamma',
                ],
            });

            const rootIndex = await fs.readFile(join(storePath, 'index.yaml'), 'utf8');

            // All categories should be listed
            expect(rootIndex).toContain('path: alpha');
            expect(rootIndex).toContain('path: beta');
            expect(rootIndex).toContain('path: gamma');
        });
    });

    describe('error details', () => {
        it('should include store name in error for invalid name', async () => {
            const registry = new FilesystemRegistry(registryPath);

            const result = await initializeStore(registry, 'INVALID', join(tempDir, 'x'));

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.store).toBe('INVALID');
                expect(result.error.message).toContain('INVALID');
            }
        });

        it('should include store name in error for duplicate', async () => {
            const registry = new FilesystemRegistry(registryPath);

            await initializeStore(registry, 'duplicate', join(tempDir, 'dup1'));
            const result = await initializeStore(registry, 'duplicate', join(tempDir, 'dup2'));

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.store).toBe('duplicate');
            }
        });
    });
});

