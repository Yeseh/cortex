import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FilesystemStoreStorage } from './store-storage.ts';
import type { FilesystemContext } from './types.ts';

describe('FilesystemStoreStorage', () => {
    let tempDir: string;
    let storage: FilesystemStoreStorage;
    let ctx: FilesystemContext;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-store-storage-'));
        ctx = {
            storeRoot: tempDir,
            memoryExtension: '.md',
            indexExtension: '.yaml',
        };
        storage = new FilesystemStoreStorage(ctx);
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('load', () => {
        it('should load an existing registry file', async () => {
            const registryPath = join(tempDir, 'stores.yaml');
            const registryContent = [
                'default:',
                `  path: ${tempDir}/default`,
                'work:',
                `  path: ${tempDir}/work`,
            ].join('\n');
            await fs.writeFile(registryPath, registryContent);

            const result = await storage.load(registryPath);

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toHaveProperty('default');
                expect(result.value).toHaveProperty('work');
                expect(result.value.default?.path).toBe(`${tempDir}/default`);
            }
        });

        it('should return error for missing file without allowMissing', async () => {
            const missingPath = join(tempDir, 'nonexistent.yaml');

            const result = await storage.load(missingPath);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('REGISTRY_MISSING');
            }
        });

        it('should return empty registry with allowMissing: true', async () => {
            const missingPath = join(tempDir, 'nonexistent.yaml');

            const result = await storage.load(missingPath, { allowMissing: true });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toEqual({});
            }
        });

        it('should return error for invalid YAML content', async () => {
            const registryPath = join(tempDir, 'invalid.yaml');
            await fs.writeFile(registryPath, 'not: valid: yaml: content:::');

            const result = await storage.load(registryPath);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('REGISTRY_PARSE_FAILED');
            }
        });
    });

    describe('save', () => {
        it('should save a registry to file', async () => {
            const registryPath = join(tempDir, 'new-stores.yaml');
            const registry = {
                default: { path: '/home/user/.cortex' },
                project: { path: '/projects/.cortex' },
            };

            const result = await storage.save(registryPath, registry);

            expect(result.ok).toBe(true);

            // Verify file was created
            const content = await fs.readFile(registryPath, 'utf8');
            expect(content).toContain('default:');
            expect(content).toContain('/home/user/.cortex');
        });

        it('should create parent directories if needed', async () => {
            const nestedPath = join(tempDir, 'deep', 'nested', 'stores.yaml');
            const registry = { test: { path: '/test' } };

            const result = await storage.save(nestedPath, registry);

            expect(result.ok).toBe(true);

            const content = await fs.readFile(nestedPath, 'utf8');
            expect(content).toContain('test:');
        });

        it('should overwrite existing registry file', async () => {
            const registryPath = join(tempDir, 'stores.yaml');
            await fs.writeFile(registryPath, 'old:\n  path: /old');

            const registry = { new: { path: '/new' } };
            const result = await storage.save(registryPath, registry);

            expect(result.ok).toBe(true);

            const content = await fs.readFile(registryPath, 'utf8');
            expect(content).toContain('new:');
            expect(content).not.toContain('old:');
        });
    });

    describe('remove', () => {
        it('should remove an existing registry file', async () => {
            const registryPath = join(tempDir, 'to-remove.yaml');
            await fs.writeFile(registryPath, 'test:\n  path: /test');

            const result = await storage.remove(registryPath);

            expect(result.ok).toBe(true);

            // Verify file is gone
            await expect(fs.access(registryPath)).rejects.toThrow();
        });

        it('should succeed silently if file does not exist', async () => {
            const missingPath = join(tempDir, 'nonexistent.yaml');

            const result = await storage.remove(missingPath);

            expect(result.ok).toBe(true);
        });
    });
});
