import { describe, expect, it } from 'bun:test';
import { Cortex } from '@yeseh/cortex-core';
import { createFilesystemAdapterFactory } from '@yeseh/cortex-storage-fs';
import { storeNameSchema, listStoresFromCortex } from './tools.ts';

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

describe('listStoresFromCortex', () => {
    it('should return empty list when registry is empty', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            registry: {},
            adapterFactory: createFilesystemAdapterFactory(),
        });

        const result = listStoresFromCortex(cortex);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores).toEqual([]);
        }
    });

    it('should list stores from registry', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            registry: {
                default: { path: '/data/default' },
                project: { path: '/data/project' },
            },
            adapterFactory: createFilesystemAdapterFactory(),
        });

        const result = listStoresFromCortex(cortex);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores).toHaveLength(2);
            expect(result.value.stores.map((s) => s.name)).toContain('default');
            expect(result.value.stores.map((s) => s.name)).toContain('project');
        }
    });

    it('should include store descriptions when present', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            registry: {
                default: {
                    path: '/data/default',
                    description: 'Default store for general memories',
                },
                project: { path: '/data/project' },
            },
            adapterFactory: createFilesystemAdapterFactory(),
        });

        const result = listStoresFromCortex(cortex);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            const defaultStore = result.value.stores.find((s) => s.name === 'default');
            const projectStore = result.value.stores.find((s) => s.name === 'project');
            expect(defaultStore?.description).toBe('Default store for general memories');
            expect(projectStore?.description).toBeUndefined();
        }
    });

    it('should return stores sorted alphabetically', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            registry: {
                zebra: { path: '/data/zebra' },
                alpha: { path: '/data/alpha' },
                middle: { path: '/data/middle' },
            },
            adapterFactory: createFilesystemAdapterFactory(),
        });

        const result = listStoresFromCortex(cortex);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.map((s) => s.name)).toEqual([
                'alpha',
                'middle',
                'zebra',
            ]);
        }
    });

    it('should include store paths in results', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            registry: {
                mystore: { path: '/custom/path/to/store' },
            },
            adapterFactory: createFilesystemAdapterFactory(),
        });

        const result = listStoresFromCortex(cortex);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores[0]?.path).toBe('/custom/path/to/store');
        }
    });
});
