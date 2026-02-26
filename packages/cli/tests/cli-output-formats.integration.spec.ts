import { afterEach, describe, expect, it } from 'bun:test';
import {
    bootstrapDefaultStoreWithProjectCategory,
    createIntegrationSandbox,
    expectSuccess,
    runCli,
    type IntegrationSandbox,
} from './test-helpers';

let sandbox: IntegrationSandbox | null = null;

afterEach(async () => {
    if (sandbox) {
        await sandbox.cleanup();
        sandbox = null;
    }
});

describe('CLI integration: output formats', () => {
    it('should return JSON for store list', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        const result = runCli([
            'store',
            'list',
            '--format',
            'json',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(result);
        const parsed = JSON.parse(result.stdout) as { kind: string; value: { stores: unknown[] } };
        expect(parsed.kind).toBe('store-registry');
        expect(Array.isArray(parsed.value.stores)).toBe(true);
    });

    it('should return JSON for memory list', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        expectSuccess(runCli([
            'memory',
            'add',
            'project/json-check',
            '--content',
            'json output check',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        }));

        const result = runCli([
            'memory',
            'list',
            'project',
            '--format',
            'json',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(result);
        const parsed = JSON.parse(result.stdout) as { memories: Array<{ path: string }>; subcategories: unknown[] };
        expect(parsed.memories.some((entry) => entry.path === 'project/json-check')).toBe(true);
        expect(Array.isArray(parsed.subcategories)).toBe(true);
    });

    it('should support toon output for memory list', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        expectSuccess(runCli([
            'memory',
            'add',
            'project/toon-check',
            '--content',
            'toon output check',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        }));

        const result = runCli([
            'memory',
            'list',
            'project',
            '--format',
            'toon',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(result);
        expect(result.output).toContain('memories');
        expect(result.output).toContain('project/toon-check');
    });
});
