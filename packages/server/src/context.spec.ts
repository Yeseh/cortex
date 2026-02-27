import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ServerConfig } from './config.ts';
import { createCortexContext, validateStorePath } from './context.ts';

const makeConfig = (dataPath: string): ServerConfig => ({
    dataPath,
    port: 3000,
    host: '127.0.0.1',
    defaultStore: 'global',
    logLevel: 'info',
    outputFormat: 'yaml',
    categoryMode: 'free',
    otelEnabled: false,
});

describe('validateStorePath', () => {
    it('should return ok for absolute paths', () => {
        const result = validateStorePath('/home/user/.cortex', 'mystore');

        expect(result.ok()).toBe(true);
    });

    it('should return ok for absolute paths with trailing slash', () => {
        const result = validateStorePath('/home/user/.cortex/', 'mystore');

        expect(result.ok()).toBe(true);
    });

    it('should return err with INVALID_STORE_PATH code for relative paths', () => {
        const result = validateStorePath('./relative', 'mystore');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
        }
    });

    it('should return err with INVALID_STORE_PATH code for bare relative path', () => {
        const result = validateStorePath('relative/path', 'mystore');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
        }
    });

    it('should include the store name in the error message', () => {
        const result = validateStorePath('./relative', 'my-special-store');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.message).toContain('my-special-store');
        }
    });

    it('should include actionable guidance in the error message', () => {
        const result = validateStorePath('./relative', 'mystore');

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.message).toContain('absolute path');
        }
    });
});

describe('createCortexContext', () => {
    let tempDir: string;

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should succeed and return ok when dataPath directory exists but no config.yaml', async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));
        const config = makeConfig(tempDir);

        const result = await createCortexContext(config);

        expect(result.ok()).toBe(true);
    });

    it('should create config.yaml on first run', async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));
        const config = makeConfig(tempDir);

        await createCortexContext(config);

        const configFile = Bun.file(join(tempDir, 'config.yaml'));
        expect(await configFile.exists()).toBe(true);
    });

    it('should create the default store directory under stores/default', async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));
        const config = makeConfig(tempDir);

        await createCortexContext(config);

        const defaultStorePath = join(tempDir, 'stores', 'global');
        const { stat } = await import('node:fs/promises');
        const dirStat = await stat(defaultStorePath);
        expect(dirStat.isDirectory()).toBe(true);
    });

    it('should succeed when config.yaml already exists', async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));
        const config = makeConfig(tempDir);

        // First run creates config
        await createCortexContext(config);

        // Second run reads existing config
        const result = await createCortexContext(config);

        expect(result.ok()).toBe(true);
    });

    it('should return ok with a valid CortexContext shape', async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));
        const config = makeConfig(tempDir);

        const result = await createCortexContext(config);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            const ctx = result.value;
            expect(ctx).toHaveProperty('cortex');
            expect(ctx).toHaveProperty('settings');
            expect(ctx).toHaveProperty('stores');
            expect(ctx).toHaveProperty('now');
            expect(typeof ctx.now).toBe('function');
        }
    });

    it('should return a now function that returns a Date', async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));
        const config = makeConfig(tempDir);

        const result = await createCortexContext(config);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            const now = result.value.now();
            expect(now).toBeInstanceOf(Date);
        }
    });

    it('should fail and return err when config.yaml contains invalid YAML content', async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));

        // Write garbage to config.yaml before calling createCortexContext
        await writeFile(join(tempDir, 'config.yaml'), ': invalid: yaml: {{{{garbage}}}}');

        const config = makeConfig(tempDir);
        const result = await createCortexContext(config);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBeDefined();
        }
    });

    it('should create context with settings matching the provided config options', async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-test-'));
        const config = makeConfig(tempDir);

        const result = await createCortexContext(config);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings).toBeDefined();
            expect(result.value.stores).toBeDefined();
        }
    });
});
