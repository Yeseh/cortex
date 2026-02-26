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

describe('CLI integration: basic', () => {
    it('should show help output', async () => {
        sandbox = await createIntegrationSandbox();

        const result = runCli([
            '--help',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(result);
        expect(result.output).toContain('Usage: cortex');
        expect(result.output).toContain('memory [options]');
        expect(result.output).toContain('store [options]');
    });

    it('should list no stores in a fresh isolated home', async () => {
        sandbox = await createIntegrationSandbox();

        const result = runCli([
            'store',
            'list',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(result);
        expect(result.output).toContain('kind: store-registry');
        expect(result.output).toContain('stores:');
    });

    it('should fail when a required argument is missing', async () => {
        sandbox = await createIntegrationSandbox();

        const result = runCli([
            'memory',
            'show',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectFailure(result, 'missing required argument');
    });
});
