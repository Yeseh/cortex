import { afterEach, describe, expect, it } from 'bun:test';
import {
    bootstrapDefaultStoreWithProjectCategory,
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

describe('CLI integration: end-to-end workflow', () => {
    it('should execute a full memory lifecycle workflow', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        expectSuccess(runCli([
            'memory',
            'add',
            'project/workflow-a',
            '--content',
            'first memory',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        }));

        expectSuccess(runCli([
            'memory',
            'add',
            'project/workflow-b',
            '--content',
            'second memory',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        }));

        const moveResult = runCli([
            'memory',
            'move',
            'project/workflow-b',
            'project/workflow-c',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });
        expectSuccess(moveResult, 'Moved memory project/workflow-b to project/workflow-c.');

        const listResult = runCli([
            'memory',
            'list',
            'project',
            '--format',
            'json',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(listResult);
        const parsed = JSON.parse(listResult.stdout) as { memories: Array<{ path: string }> };
        const paths = parsed.memories.map((entry) => entry.path);
        expect(paths).toContain('project/workflow-a');
        expect(paths).toContain('project/workflow-c');
        expect(paths).not.toContain('project/workflow-b');

        expectSuccess(runCli([
            'memory',
            'remove',
            'project/workflow-a',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        }));

        const showRemoved = runCli([
            'memory',
            'show',
            'project/workflow-a',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectFailure(showRemoved, 'Memory not found');
    });
});
