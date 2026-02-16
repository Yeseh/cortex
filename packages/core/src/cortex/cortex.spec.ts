import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Cortex } from './cortex.ts';
import { DEFAULT_CORTEX_SETTINGS } from '../config.ts';
import type { ScopedStorageAdapter } from '../storage/adapter.ts';
import { ok } from '../result.ts';

// Mock adapter factory for testing
const createMockAdapter = (_storePath: string): ScopedStorageAdapter => ({
    memories: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        remove: async () => ok(undefined),
        move: async () => ok(undefined),
    },
    indexes: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        reindex: async () => ok({ warnings: [] }),
        updateAfterMemoryWrite: async () => ok(undefined),
    },
    categories: {
        exists: async () => ok(false),
        ensure: async () => ok(undefined),
        delete: async () => ok(undefined),
        updateSubcategoryDescription: async () => ok(undefined),
        removeSubcategoryEntry: async () => ok(undefined),
    },
});

describe('Cortex.init', () => {
    it('should create Cortex with default values', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
        });

        expect(cortex.rootDirectory).toBe('/tmp/test');
        expect(cortex.settings).toEqual(DEFAULT_CORTEX_SETTINGS);
        expect(cortex.getStoreDefinitions()).toEqual({});
    });

    it('should create Cortex with custom settings', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            settings: { outputFormat: 'json' },
        });

        expect(cortex.settings.outputFormat).toBe('json');
        expect(cortex.settings.autoSummary).toBe(false); // default
    });

    it('should create Cortex with custom adapter factory', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            registry: { test: { path: '/tmp/store' } },
            adapterFactory: createMockAdapter,
        });

        const result = cortex.getStore('test');
        expect(result.ok()).toBe(true);
    });
});

describe('Cortex.fromConfig', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should load config from file', async () => {
        const configYaml = `
settings:
  output_format: json
  auto_summary: true
stores:
  default:
    path: /tmp/default
`;
        await writeFile(join(tempDir, 'config.yaml'), configYaml);

        const result = await Cortex.fromConfig(tempDir, createMockAdapter);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings.outputFormat).toBe('json');
            expect(result.value.settings.autoSummary).toBe(true);
            expect(result.value.getStoreDefinitions().default?.path).toBe('/tmp/default');
        }
    });

    it('should return CONFIG_NOT_FOUND for missing config', async () => {
        const result = await Cortex.fromConfig(join(tempDir, 'nonexistent'), createMockAdapter);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_NOT_FOUND');
        }
    });

    it('should return CONFIG_PARSE_FAILED for invalid YAML', async () => {
        await writeFile(join(tempDir, 'config.yaml'), '{ invalid yaml without closing');
        const result = await Cortex.fromConfig(tempDir, createMockAdapter);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_PARSE_FAILED');
        }
    });
});

describe('Cortex.initialize', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should create config file if not exists', async () => {
        const cortex = Cortex.init({
            rootDirectory: join(tempDir, 'new-dir'),
            registry: { test: { path: '/tmp/test' } },
        });

        const result = await cortex.initialize();
        expect(result.ok()).toBe(true);

        const configContent = await readFile(join(tempDir, 'new-dir', 'config.yaml'), 'utf8');
        expect(configContent).toContain('stores:');
        expect(configContent).toContain('path: /tmp/test');
    });

    it('should be idempotent - not overwrite existing config', async () => {
        const configPath = join(tempDir, 'config.yaml');
        await writeFile(configPath, 'original: content\n');

        const cortex = Cortex.init({ rootDirectory: tempDir });
        const result = await cortex.initialize();
        expect(result.ok()).toBe(true);

        const content = await readFile(configPath, 'utf8');
        expect(content).toBe('original: content\n');
    });
});

describe('Cortex.getStore', () => {
    it('should return adapter for registered store', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            registry: { mystore: { path: '/tmp/mystore' } },
            adapterFactory: createMockAdapter,
        });

        const result = cortex.getStore('mystore');
        expect(result.ok()).toBe(true);
    });

    it('should return STORE_NOT_FOUND for unknown store', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            registry: { known: { path: '/tmp/known' } },
            adapterFactory: createMockAdapter,
        });

        const result = cortex.getStore('unknown');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('STORE_NOT_FOUND');
            expect(result.error.store).toBe('unknown');
            expect(result.error.message).toContain('known'); // lists available stores
        }
    });

    it('should return STORE_NOT_FOUND with empty store list', () => {
        const cortex = Cortex.init({
            rootDirectory: '/tmp/test',
            registry: {},
            adapterFactory: createMockAdapter,
        });

        const result = cortex.getStore('any');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.message).toContain('none');
        }
    });
});
