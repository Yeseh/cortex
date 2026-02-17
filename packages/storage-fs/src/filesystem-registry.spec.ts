import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FilesystemRegistry } from './filesystem-registry.ts';

describe('FilesystemRegistry', () => {
    let tempDir: string;
    let configPath: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-filesystem-registry-'));
        configPath = join(tempDir, 'config.yaml');
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('initialize', () => {
        it('should create config file if it does not exist', async () => {
            const registry = new FilesystemRegistry(configPath);

            const result = await registry.initialize();

            expect(result.ok()).toBe(true);

            // Verify file was created with merged format
            const content = await fs.readFile(configPath, 'utf8');
            expect(content).toContain('settings:');
            expect(content).toContain('outputFormat: yaml');
            expect(content).toContain('autoSummaryThreshold: 0');
            expect(content).toContain('strictLocal: false');
        });

        it('should create parent directories if needed', async () => {
            const nestedPath = join(tempDir, 'deep', 'nested', 'config.yaml');
            const registry = new FilesystemRegistry(nestedPath);

            const result = await registry.initialize();

            expect(result.ok()).toBe(true);

            const content = await fs.readFile(nestedPath, 'utf8');
            expect(content).toContain('settings:');
        });

        it('should not overwrite existing config file', async () => {
            const existingContent = `settings:
  outputFormat: json
  autoSummaryThreshold: 10
  strictLocal: false
stores:
  default:
    path: "/existing"
`;
            await fs.writeFile(configPath, existingContent);

            const registry = new FilesystemRegistry(configPath);
            const result = await registry.initialize();

            expect(result.ok()).toBe(true);

            // Verify file was not changed
            const content = await fs.readFile(configPath, 'utf8');
            expect(content).toBe(existingContent);
        });
    });

    describe('load', () => {
        it('should load an existing config file', async () => {
            const configContent = `settings:
  outputFormat: yaml
  autoSummaryThreshold: 0
  strictLocal: false
stores:
  default:
    path: ${tempDir}/default
  work:
    path: ${tempDir}/work
`;
            await fs.writeFile(configPath, configContent);

            const registry = new FilesystemRegistry(configPath);
            const result = await registry.load();

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toHaveProperty('default');
                expect(result.value).toHaveProperty('work');
                expect(result.value.default?.path).toBe(`${tempDir}/default`);
            }
        });

        it('should return error for missing file', async () => {
            const missingPath = join(tempDir, 'nonexistent.yaml');
            const registry = new FilesystemRegistry(missingPath);

            const result = await registry.load();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('REGISTRY_MISSING');
            }
        });

        it('should return error for invalid YAML content', async () => {
            await fs.writeFile(configPath, 'not: valid: yaml: content:::');

            const registry = new FilesystemRegistry(configPath);
            const result = await registry.load();

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('REGISTRY_PARSE_FAILED');
            }
        });

        it('should reject relative store paths', async () => {
            const content = `
stores:
  invalid:
    path: ./relative/path
`;
            await fs.writeFile(configPath, content);
            const registry = new FilesystemRegistry(configPath);
            const result = await registry.load();
            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('REGISTRY_PARSE_FAILED');
            }
        });
    });

    describe('save', () => {
        it('should save a registry to file', async () => {
            const registry = new FilesystemRegistry(configPath);
            const storeRegistry = {
                default: { path: '/home/user/.cortex' },
                project: { path: '/projects/.cortex' },
            };

            const result = await registry.save(storeRegistry);

            expect(result.ok()).toBe(true);

            // Verify file was created with merged format
            const content = await fs.readFile(configPath, 'utf8');
            expect(content).toContain('settings:');
            expect(content).toContain('stores:');
            expect(content).toContain('default:');
            expect(content).toContain('/home/user/.cortex');
        });

        it('should create parent directories if needed', async () => {
            const nestedPath = join(tempDir, 'deep', 'nested', 'config.yaml');
            const registry = new FilesystemRegistry(nestedPath);
            const storeRegistry = { test: { path: '/test' } };

            const result = await registry.save(storeRegistry);

            expect(result.ok()).toBe(true);

            const content = await fs.readFile(nestedPath, 'utf8');
            expect(content).toContain('test:');
        });

        it('should overwrite existing registry file', async () => {
            const existingContent = `settings:
  outputFormat: yaml
  autoSummaryThreshold: 0
  strictLocal: false
stores:
  existing-store:
    path: "/existing"
`;
            await fs.writeFile(configPath, existingContent);

            const registry = new FilesystemRegistry(configPath);
            const storeRegistry = { 'new-store': { path: '/new' } };

            const result = await registry.save(storeRegistry);

            expect(result.ok()).toBe(true);

            const content = await fs.readFile(configPath, 'utf8');
            expect(content).toContain('new-store:');
            expect(content).not.toContain('existing-store:');
        });

        it('should preserve existing settings when saving', async () => {
            const existingContent = `settings:
  outputFormat: json
  autoSummaryThreshold: 10
  strictLocal: true
stores:
  old:
    path: "/old"
`;
            await fs.writeFile(configPath, existingContent);

            const registry = new FilesystemRegistry(configPath);
            const storeRegistry = { new: { path: '/new' } };

            const result = await registry.save(storeRegistry);

            expect(result.ok()).toBe(true);

            const content = await fs.readFile(configPath, 'utf8');
            expect(content).toContain('outputFormat: json');
            expect(content).toContain('autoSummaryThreshold: 10');
            expect(content).toContain('strictLocal: true');
        });

        it('should update internal cache', async () => {
            const registry = new FilesystemRegistry(configPath);
            const storeRegistry = { mystore: { path: '/mystore' } };

            await registry.save(storeRegistry);

            // getStore should work without calling load()
            const storeResult = registry.getStore('mystore');
            expect(storeResult.ok()).toBe(true);
        });
    });

    describe('getSettings', () => {
        it('should return settings from loaded config', async () => {
            const content = `
settings:
  outputFormat: json
  autoSummaryThreshold: 10
  strictLocal: false
stores:
  test:
    path: ${tempDir}/test
`;
            await fs.writeFile(configPath, content);
            const registry = new FilesystemRegistry(configPath);
            await registry.load();

            const settings = registry.getSettings();
            expect(settings.outputFormat).toBe('json');
            expect(settings.autoSummaryThreshold).toBe(10);
        });

        it('should return default settings if not loaded', async () => {
            const registry = new FilesystemRegistry(configPath);

            const settings = registry.getSettings();
            expect(settings.outputFormat).toBe('yaml');
            expect(settings.autoSummaryThreshold).toBe(0);
            expect(settings.strictLocal).toBe(false);
        });
    });

    describe('getStore', () => {
        it('should throw if load() has not been called', () => {
            const registry = new FilesystemRegistry(configPath);

            expect(() => registry.getStore('default')).toThrow(
                'Registry not loaded. Call load() first.',
            );
        });

        it('should return scoped adapter for existing store', async () => {
            const storePath = join(tempDir, 'mystore');
            await fs.mkdir(storePath, { recursive: true });

            const configContent = `settings:
  outputFormat: yaml
  autoSummaryThreshold: 0
  strictLocal: false
stores:
  mystore:
    path: ${storePath}
`;
            await fs.writeFile(configPath, configContent);

            const registry = new FilesystemRegistry(configPath);
            await registry.load();

            const result = registry.getStore('mystore');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toHaveProperty('memories');
                expect(result.value).toHaveProperty('indexes');
                expect(result.value).toHaveProperty('categories');
            }
        });

        it('should return error for non-existent store', async () => {
            const configContent = `settings:
  outputFormat: yaml
  autoSummaryThreshold: 0
  strictLocal: false
stores:
  default:
    path: /default
`;
            await fs.writeFile(configPath, configContent);

            const registry = new FilesystemRegistry(configPath);
            await registry.load();

            const result = registry.getStore('nonexistent');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('STORE_NOT_FOUND');
                expect(result.error.store).toBe('nonexistent');
            }
        });

        it('should return working storage adapter', async () => {
            const storePath = join(tempDir, 'workingstore');
            await fs.mkdir(storePath, { recursive: true });

            const configContent = `settings:
  outputFormat: yaml
  autoSummaryThreshold: 0
  strictLocal: false
stores:
  workingstore:
    path: ${storePath}
`;
            await fs.writeFile(configPath, configContent);

            const registry = new FilesystemRegistry(configPath);
            await registry.load();

            const storeResult = registry.getStore('workingstore');
            expect(storeResult.ok()).toBe(true);

            if (storeResult.ok()) {
                // Test that the adapter actually works
                const { Memory } = await import('@yeseh/cortex-core/memory');
                const memoryResult = Memory.init(
                    'test/memory',
                    {
                        createdAt: new Date('2024-01-01T00:00:00.000Z'),
                        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
                        tags: [],
                        source: 'test',
                        citations: [],
                    },
                    'Test memory content.',
                );

                expect(memoryResult.ok()).toBe(true);
                if (!memoryResult.ok()) return;

                const memory = memoryResult.value;

                const writeResult = await storeResult.value.memories.write(memory);
                expect(writeResult.ok()).toBe(true);

                const readResult = await storeResult.value.memories.read(memory.path);
                expect(readResult.ok()).toBe(true);
                if (readResult.ok() && readResult.value) {
                    expect(readResult.value.content).toBe('Test memory content.');
                }
            }
        });
    });
});
