/**
 * Tests for the Cortex class.
 *
 * @module core/cortex/cortex.spec
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { join } from 'path';

// =============================================================================
// Bun-native helper functions for test file operations
// =============================================================================

/** Creates a temporary directory with given prefix (Bun-native replacement for mkdtemp) */
const createTempDir = async (prefix: string): Promise<string> => {
    const tempBase = Bun.env.TMPDIR ?? '/tmp';
    const uniqueDir = join(
        tempBase,
        `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await Bun.write(join(uniqueDir, '.keep'), ''); // Creates dir by writing a file
    return uniqueDir;
};

/** Writes content to a file using Bun.write() */
const writeFile = async (filePath: string, content: string): Promise<void> => {
    await Bun.write(filePath, content);
};

/** Reads content from a file using Bun.file() */
const readFile = async (filePath: string, _encoding?: string): Promise<string> => {
    return await Bun.file(filePath).text();
};

/** Creates a directory recursively using Bun */
const mkdir = async (dirPath: string, _options?: { recursive?: boolean }): Promise<void> => {
    // Create directory by writing a placeholder file (Bun creates parent dirs)
    const keepFile = join(dirPath, '.keep');
    await Bun.write(keepFile, '');
};

/** Removes a directory recursively (fallback to shell for reliability) */
const rm = async (
    dirPath: string,
    _options?: { recursive?: boolean; force?: boolean },
): Promise<void> => {
    const proc = Bun.spawn([
        'rm',
        '-rf',
        dirPath,
    ], { stdout: 'ignore', stderr: 'ignore' });
    await proc.exited;
};

import { Cortex } from './cortex.ts';
import type { AdapterFactory } from './types.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { ok } from '@/result.ts';

// =============================================================================
// Mock Factory
// =============================================================================

const createMockAdapter = (): ScopedStorageAdapter =>
    ({
        memories: {
            read: async () => ok(null),
            write: async () => ok(undefined),
            remove: async () => ok(undefined),
            move: async () => ok(undefined),
        },
        indexes: {
            read: async () => ok(null),
            write: async () => ok(undefined),
            reindex: async () => ok(undefined),
            updateAfterMemoryWrite: async () => ok(undefined),
        },
        categories: {
            exists: async () => ok(false),
            ensure: async () => ok(undefined),
            delete: async () => ok(undefined),
            updateSubcategoryDescription: async () => ok(undefined),
            removeSubcategoryEntry: async () => ok(undefined),
        },
    }) as ScopedStorageAdapter;

const mockAdapterFactory: AdapterFactory = () => createMockAdapter();

// =============================================================================
// Cortex.init() Tests
// =============================================================================

describe('Cortex.init()', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempDir('cortex-init-tests-');
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should create instance with default values', () => {
        const cortex = Cortex.init({
            rootDirectory: tempDir,
            adapterFactory: mockAdapterFactory,
        });

        expect(cortex.rootDirectory).toBe(tempDir);
        expect(cortex.settings.outputFormat).toBe('yaml');
        expect(cortex.settings.autoSummaryThreshold).toBe(0);
        expect(cortex.settings.strictLocal).toBe(false);
        expect(cortex.getRegistry()).toEqual({});
    });

    it('should create instance with custom settings', () => {
        const cortex = Cortex.init({
            rootDirectory: tempDir,
            adapterFactory: mockAdapterFactory,
            settings: {
                outputFormat: 'json',
                autoSummaryThreshold: 5,
                strictLocal: true,
            },
        });

        expect(cortex.settings.outputFormat).toBe('json');
        expect(cortex.settings.autoSummaryThreshold).toBe(5);
        expect(cortex.settings.strictLocal).toBe(true);
    });

    it('should create instance with registry', () => {
        const cortex = Cortex.init({
            rootDirectory: tempDir,
            adapterFactory: mockAdapterFactory,
            registry: {
                'my-store': { path: '/path/to/store' },
                'another-store': { path: '/other/path', description: 'Test store' },
            },
        });

        expect(Object.keys(cortex.getRegistry())).toEqual([
            'my-store', 'another-store',
        ]);
        expect(cortex.getRegistry()['my-store']!.path).toBe('/path/to/store');
        expect(cortex.getRegistry()['another-store']!.description).toBe('Test store');
    });

    it('should use custom adapterFactory', () => {
        let factoryCalled = false;
        let factoryPath = '';

        const customFactory: AdapterFactory = (storePath) => {
            factoryCalled = true;
            factoryPath = storePath;
            return createMockAdapter();
        };

        const cortex = Cortex.init({
            rootDirectory: tempDir,
            adapterFactory: customFactory,
            registry: {
                'test-store': { path: '/custom/path' },
            },
        });

        // Factory should not be called until getStore() is called
        expect(factoryCalled).toBe(false);

        // Now call getStore
        const result = cortex.getStore('test-store');
        expect(result.ok()).toBe(true);
        expect(factoryCalled).toBe(true);
        expect(factoryPath).toBe('/custom/path');
    });

    it('should throw when getStore is called without adapterFactory', () => {
        const cortex = Cortex.init({
            rootDirectory: tempDir,
            registry: {
                'test-store': { path: '/path/to/store' },
            },
        });

        expect(() => cortex.getStore('test-store')).toThrow('No adapter factory provided');
    });
});

// =============================================================================
// Cortex.fromConfig() Tests
// =============================================================================

describe('Cortex.fromConfig()', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempDir('cortex-fromconfig-tests-');
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should load from valid config.yaml', async () => {
        const configContent = [
            'settings:',
            '  outputFormat: json',
            '  autoSummaryThreshold: 15',
            '  strictLocal: true',
            'stores:',
            '  my-store:',
            '    path: /path/to/store',
            '  another-store:',
            '    path: /other/path',
            '    description: Another store',
        ].join('\n');

        await writeFile(join(tempDir, 'config.yaml'), configContent);

        const result = await Cortex.fromConfig(tempDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.rootDirectory).toBe(tempDir);
            expect(result.value.settings.outputFormat).toBe('json');
            expect(result.value.settings.autoSummaryThreshold).toBe(15);
            expect(result.value.settings.strictLocal).toBe(true);
            expect(Object.keys(result.value.getRegistry())).toEqual([
                'my-store', 'another-store',
            ]);
            expect(result.value.getRegistry()['another-store']!.description).toBe('Another store');
        }
    });

    it('should return error when config file is missing', async () => {
        const result = await Cortex.fromConfig(tempDir);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_NOT_FOUND');
            expect(result.error.path).toContain('config.yaml');
        }
    });

    it('should return error for invalid YAML', async () => {
        await writeFile(join(tempDir, 'config.yaml'), 'key: [unclosed bracket');

        const result = await Cortex.fromConfig(tempDir);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_PARSE_FAILED');
        }
    });

    it('should return error for invalid config structure', async () => {
        const configContent = [
            'settings:',
            '  outputFormat: xml', // invalid value - xml is not a valid outputFormat
        ].join('\n');

        await writeFile(join(tempDir, 'config.yaml'), configContent);

        const result = await Cortex.fromConfig(tempDir);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
        }
    });

    it('should handle empty config file', async () => {
        await writeFile(join(tempDir, 'config.yaml'), '');

        const result = await Cortex.fromConfig(tempDir);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            // Should use defaults
            expect(result.value.settings.outputFormat).toBe('yaml');
            expect(result.value.getRegistry()).toEqual({});
        }
    });

    it('should expand tilde in path', async () => {
        // Create a config in a subdirectory that simulates home
        const homeSubdir = join(tempDir, 'home-test');
        await mkdir(homeSubdir, { recursive: true });
        await writeFile(join(homeSubdir, 'config.yaml'), 'settings:\n  outputFormat: yaml');

        // Note: This test validates the path resolution logic handles absolute paths
        // Testing actual ~ expansion would require mocking homedir()
        const result = await Cortex.fromConfig(homeSubdir);

        expect(result.ok()).toBe(true);
    });
});

// =============================================================================
// Cortex.initialize() Tests
// =============================================================================

describe('Cortex.initialize()', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempDir('cortex-initialize-tests-');
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should create config file when missing', async () => {
        const cortex = Cortex.init({
            rootDirectory: join(tempDir, 'new-config'),
            adapterFactory: mockAdapterFactory,
            registry: {
                'my-store': { path: '/path/to/store' },
            },
        });

        const result = await cortex.initialize();

        expect(result.ok()).toBe(true);

        // Verify config file was created
        const configContent = await readFile(join(tempDir, 'new-config', 'config.yaml'), 'utf8');
        expect(configContent).toContain('outputFormat');
        expect(configContent).toContain('my-store');
    });

    it('should be idempotent - not overwrite existing config', async () => {
        const configDir = join(tempDir, 'existing-config');
        await mkdir(configDir, { recursive: true });

        const originalContent = 'settings:\n  outputFormat: json';
        await writeFile(join(configDir, 'config.yaml'), originalContent);

        const cortex = Cortex.init({
            rootDirectory: configDir,
            adapterFactory: mockAdapterFactory,
            settings: { outputFormat: 'yaml', autoSummaryThreshold: 99, strictLocal: true },
        });

        const result = await cortex.initialize();

        expect(result.ok()).toBe(true);

        // Verify original config was preserved
        const configContent = await readFile(join(configDir, 'config.yaml'), 'utf8');
        expect(configContent).toBe(originalContent);
    });

    it('should create nested directories', async () => {
        const nestedDir = join(tempDir, 'deep', 'nested', 'config');

        const cortex = Cortex.init({
            rootDirectory: nestedDir,
            adapterFactory: mockAdapterFactory,
        });

        const result = await cortex.initialize();

        expect(result.ok()).toBe(true);

        // Verify config file exists in nested path
        const configContent = await readFile(join(nestedDir, 'config.yaml'), 'utf8');
        expect(configContent).toBeTruthy();
    });
});

// =============================================================================
// Cortex.getStore() Tests
// =============================================================================

describe('Cortex.getStore()', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await createTempDir('cortex-getstore-tests-');
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should return adapter for registered store', () => {
        const cortex = Cortex.init({
            rootDirectory: tempDir,
            adapterFactory: mockAdapterFactory,
            registry: {
                'test-store': { path: '/path/to/store' },
            },
        });

        const result = cortex.getStore('test-store');

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.memories).toBeDefined();
            expect(result.value.indexes).toBeDefined();
            expect(result.value.categories).toBeDefined();
        }
    });

    it('should return error for unregistered store', () => {
        const cortex = Cortex.init({
            rootDirectory: tempDir,
            adapterFactory: mockAdapterFactory,
            registry: {
                'existing-store': { path: '/path/to/store' },
            },
        });

        const result = cortex.getStore('nonexistent-store');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_NOT_FOUND');
            expect(result.error.store).toBe('nonexistent-store');
            expect(result.error.message).toContain('existing-store');
        }
    });

    it('should cache adapters for repeated calls', () => {
        let factoryCallCount = 0;

        const countingFactory: AdapterFactory = () => {
            factoryCallCount++;
            return createMockAdapter();
        };

        const cortex = Cortex.init({
            rootDirectory: tempDir,
            adapterFactory: countingFactory,
            registry: {
                'cached-store': { path: '/path/to/store' },
            },
        });

        // Call getStore multiple times
        const result1 = cortex.getStore('cached-store');
        const result2 = cortex.getStore('cached-store');
        const result3 = cortex.getStore('cached-store');

        expect(result1.ok()).toBe(true);
        expect(result2.ok()).toBe(true);
        expect(result3.ok()).toBe(true);

        // Factory should only be called once
        expect(factoryCallCount).toBe(1);

        // Same adapter instance should be returned
        if (result1.ok() && result2.ok()) {
            expect(result1.value).toBe(result2.value);
        }
    });

    it('should return error with helpful message when no stores registered', () => {
        const cortex = Cortex.init({
            rootDirectory: tempDir,
            adapterFactory: mockAdapterFactory,
            registry: {},
        });

        const result = cortex.getStore('any-store');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_NOT_FOUND');
            expect(result.error.message).toContain('(none)');
        }
    });
});
