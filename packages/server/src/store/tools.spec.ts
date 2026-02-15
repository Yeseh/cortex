import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { storeNameSchema, listStores, listStoresFromRegistry } from './tools.ts';

describe('storeNameSchema', () => {
    describe('valid names', () => {
        it('should accept "default"', () => {
            const result = storeNameSchema.safeParse('default');
            expect(result.success).toBe(true);
        });

        it('should accept "my-store"', () => {
            const result = storeNameSchema.safeParse('my-store');
            expect(result.success).toBe(true);
        });

        it('should accept "store_1"', () => {
            const result = storeNameSchema.safeParse('store_1');
            expect(result.success).toBe(true);
        });

        it('should accept "A123"', () => {
            const result = storeNameSchema.safeParse('A123');
            expect(result.success).toBe(true);
        });

        it('should accept single alphanumeric character', () => {
            const result = storeNameSchema.safeParse('a');
            expect(result.success).toBe(true);
        });

        it('should accept numeric start character', () => {
            const result = storeNameSchema.safeParse('1store');
            expect(result.success).toBe(true);
        });

        it('should accept mixed case with hyphens and underscores', () => {
            const result = storeNameSchema.safeParse('My-Store_V2');
            expect(result.success).toBe(true);
        });
    });

    describe('invalid names', () => {
        it('should reject empty string', () => {
            const result = storeNameSchema.safeParse('');
            expect(result.success).toBe(false);
            if (!result.success) {
                // Empty string fails both min length and regex checks
                expect(result.error.issues.length).toBeGreaterThanOrEqual(1);
                // The first issue should be the min length error
                expect(result.error.issues[0]?.message).toBe('Store name must not be empty');
            }
        });

        it('should reject names starting with hyphen', () => {
            const result = storeNameSchema.safeParse('-store');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric',
                );
            }
        });

        it('should reject names starting with underscore', () => {
            const result = storeNameSchema.safeParse('_store');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric',
                );
            }
        });

        it('should reject names with spaces', () => {
            const result = storeNameSchema.safeParse('my store');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric',
                );
            }
        });

        it('should reject names with @ symbol', () => {
            const result = storeNameSchema.safeParse('store@1');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric',
                );
            }
        });

        it('should reject names with dots', () => {
            const result = storeNameSchema.safeParse('store.name');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0]?.message).toContain(
                    'Store name must start with alphanumeric',
                );
            }
        });

        it('should reject names with slashes', () => {
            const result = storeNameSchema.safeParse('store/name');
            expect(result.success).toBe(false);
        });

        it('should reject names with backslashes', () => {
            const result = storeNameSchema.safeParse('store\\name');
            expect(result.success).toBe(false);
        });
    });
});

describe('listStores', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-test-'));
    });

    afterEach(async () => {
        await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should return empty array when data path does not exist', async () => {
        const nonExistentPath = path.join(testDir, 'non-existent');
        const result = await listStores(nonExistentPath);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toEqual([]);
        }
    });

    it('should return empty array when data path is empty', async () => {
        const result = await listStores(testDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toEqual([]);
        }
    });

    it('should return store names from directory', async () => {
        // Create some store directories
        await fs.mkdir(path.join(testDir, 'store-a'));
        await fs.mkdir(path.join(testDir, 'store-b'));
        await fs.mkdir(path.join(testDir, 'default'));

        const result = await listStores(testDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toHaveLength(3);
            expect(result.value).toContain('store-a');
            expect(result.value).toContain('store-b');
            expect(result.value).toContain('default');
        }
    });

    it('should only return directories, not files', async () => {
        // Create a mix of files and directories
        await fs.mkdir(path.join(testDir, 'real-store'));
        await fs.writeFile(path.join(testDir, 'not-a-store.txt'), 'content');
        await fs.writeFile(path.join(testDir, 'another-file'), 'content');

        const result = await listStores(testDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toEqual(['real-store']);
        }
    });

    it('should return STORE_LIST_FAILED error when path is a file, not a directory', async () => {
        const filePath = path.join(testDir, 'not-a-directory');
        await fs.writeFile(filePath, 'content');

        const result = await listStores(filePath);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_LIST_FAILED');
            expect(result.error.message).toContain('Failed to list stores');
        }
    });

    it('should handle multiple stores with different naming conventions', async () => {
        await fs.mkdir(path.join(testDir, 'project-alpha'));
        await fs.mkdir(path.join(testDir, 'project_beta'));
        await fs.mkdir(path.join(testDir, 'Project123'));

        const result = await listStores(testDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toHaveLength(3);
            expect(result.value).toContain('project-alpha');
            expect(result.value).toContain('project_beta');
            expect(result.value).toContain('Project123');
        }
    });
});

describe('listStoresFromRegistry', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cortex-store-tools-'));
    });

    afterEach(async () => {
        if (testDir) {
            await fs.rm(testDir, { recursive: true, force: true });
        }
    });

    it('should list stores with descriptions', async () => {
        const registryContent = [
            'stores:',
            '  default:',
            '    path: "/data/default"',
            '    description: "Default store for general memories"',
            '  project:',
            '    path: "/data/project"',
            '    description: "Project-specific memories"',
        ].join('\n');

        await fs.writeFile(path.join(testDir, 'stores.yaml'), registryContent);

        const result = await listStoresFromRegistry(path.join(testDir, 'stores.yaml'));

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores).toHaveLength(2);
            const defaultStore = result.value.stores.find((s) => s.name === 'default');
            expect(defaultStore?.description).toBe('Default store for general memories');
            const projectStore = result.value.stores.find((s) => s.name === 'project');
            expect(projectStore?.description).toBe('Project-specific memories');
        }
    });

    it('should list stores without descriptions', async () => {
        const registryContent = [
            'stores:',
            '  default:',
            '    path: "/data/default"',
        ].join('\n');

        await fs.writeFile(path.join(testDir, 'stores.yaml'), registryContent);

        const result = await listStoresFromRegistry(path.join(testDir, 'stores.yaml'));

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores).toHaveLength(1);
            expect(result.value.stores[0]?.description).toBeUndefined();
        }
    });

    it('should return empty list when registry is missing', async () => {
        const result = await listStoresFromRegistry(path.join(testDir, 'nonexistent.yaml'));

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores).toEqual([]);
        }
    });

    it('should return stores sorted alphabetically', async () => {
        const registryContent = [
            'stores:',
            '  zebra:',
            '    path: "/data/zebra"',
            '  alpha:',
            '    path: "/data/alpha"',
            '  middle:',
            '    path: "/data/middle"',
        ].join('\n');

        await fs.writeFile(path.join(testDir, 'stores.yaml'), registryContent);

        const result = await listStoresFromRegistry(path.join(testDir, 'stores.yaml'));

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.map((s) => s.name)).toEqual([
                'alpha',
                'middle',
                'zebra',
            ]);
        }
    });

    it('should handle mixed stores with and without descriptions', async () => {
        const registryContent = [
            'stores:',
            '  with-desc:',
            '    path: "/data/with"',
            '    description: "Has description"',
            '  without-desc:',
            '    path: "/data/without"',
        ].join('\n');

        await fs.writeFile(path.join(testDir, 'stores.yaml'), registryContent);

        const result = await listStoresFromRegistry(path.join(testDir, 'stores.yaml'));

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            const withDesc = result.value.stores.find((s) => s.name === 'with-desc');
            const withoutDesc = result.value.stores.find((s) => s.name === 'without-desc');
            expect(withDesc?.description).toBe('Has description');
            expect(withoutDesc?.description).toBeUndefined();
            // Verify 'description' key is present vs absent (not undefined value)
            expect('description' in withDesc!).toBe(true);
            expect('description' in withoutDesc!).toBe(false);
        }
    });
});
