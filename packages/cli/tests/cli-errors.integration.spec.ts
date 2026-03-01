import { afterEach, describe, expect, it } from 'bun:test';
import {
    bootstrapDefaultStoreWithProjectCategory,
    createIntegrationSandbox,
    expectFailure,
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

describe('CLI integration: error handling', () => {
    it('should fail with a single missing-content error message', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        const result = runCli(['memory', 'add', 'project/needs-content'], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectFailure(result, 'Memory content is required via --content, --file, or stdin.');
        expect(result.stderr).not.toContain('error="Memory content is required via --content, --file, or stdin."');
    });

    it('should fail on invalid expires-at value', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        const result = runCli(
            [
                'memory',
                'add',
                'project/bad-expiry',
                '--content',
                'temp note',
                '--expires-at',
                'not-a-date',
            ],
            {
                env: sandbox.env,
                cwd: sandbox.projectDir,
            }
        );

        expectFailure(result, 'Invalid expiration date format');
    });

    it('should fail when an unknown store is requested', async () => {
        sandbox = await createIntegrationSandbox();

        const result = runCli(['memory', '--store', 'missing', 'list'], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectFailure(result, "Store 'missing' is not registered");
    });

    it('should fail when update has no update fields', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        const addResult = runCli(
            ['memory', 'add', 'project/no-update', '--content', 'seed content'],
            {
                env: sandbox.env,
                cwd: sandbox.projectDir,
            }
        );

        if (addResult.exitCode !== 0) {
            throw new Error(`Setup failed: ${addResult.output}`);
        }

        const result = runCli(['memory', 'update', 'project/no-update'], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectFailure(result, 'No updates provided');
    });
});
