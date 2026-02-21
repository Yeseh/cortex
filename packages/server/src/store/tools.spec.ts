import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { storeNameSchema, listStores } from './tools.ts';

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
