import { afterEach, describe, expect, it } from 'bun:test';
import {
    createIntegrationSandbox,
    expectFailure,
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

describe('CLI integration: store commands', () => {
    it('should add and list a store', async () => {
        sandbox = await createIntegrationSandbox();

        const addResult = runCli([
            'store',
            'add',
            'global',
            sandbox.storeDir,
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(addResult, 'name: global');

        const listResult = runCli([
            'store',
            'list',
            '--format',
            'json',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(listResult);
        const parsed = JSON.parse(listResult.stdout) as {
            kind: string;
            value: { stores: Array<{ name: string; path: string }> };
        };

        expect(parsed.kind).toBe('store-registry');
        expect(parsed.value.stores.some((store) => store.name === 'global')).toBe(true);
    });

    it('should fail when adding duplicate store', async () => {
        sandbox = await createIntegrationSandbox();

        const firstAdd = runCli([
            'store',
            'add',
            'global',
            sandbox.storeDir,
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });
        expectSuccess(firstAdd);

        const secondAdd = runCli([
            'store',
            'add',
            'global',
            sandbox.storeDir,
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectFailure(secondAdd, 'already registered');
    });

    it('should remove a registered store', async () => {
        sandbox = await createIntegrationSandbox();

        const addResult = runCli([
            'store',
            'add',
            'global',
            sandbox.storeDir,
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });
        expectSuccess(addResult);

        const removeResult = runCli([
            'store',
            'remove',
            'global',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(removeResult, 'name: global');

        const listResult = runCli([
            'store',
            'list',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(listResult);
        expect(listResult.output).not.toContain('name: global');
    });
});
