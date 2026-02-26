import { afterEach, describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import {
    bootstrapDefaultStoreWithProjectCategory,
    createIntegrationSandbox,
    expectFailure,
    expectSuccess,
    readMemoryFile,
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

describe('CLI integration: memory commands', () => {
    it('should add and show a memory from inline content', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        const addResult = runCli([
            'memory',
            'add',
            'project/architecture',
            '--content',
            'Use Bun runtime for fast startup.',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(addResult, 'Added memory project/architecture');

        const showResult = runCli([
            'memory',
            'show',
            'project/architecture',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(showResult);
        expect(showResult.output).toContain('path: project/architecture');
        expect(showResult.output).toContain('content: Use Bun runtime for fast startup.');
    });

    it('should add a memory from --file input', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        const fixturePath = join(sandbox.projectDir, 'stdin-source.txt');
        await writeFile(fixturePath, 'file payload for memory add', 'utf8');

        const addResult = runCli([
            'memory',
            'add',
            'project/stdin-note',
            '--file',
            fixturePath,
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(addResult, 'Added memory project/stdin-note');

        const saved = await readMemoryFile(sandbox.storeDir, 'project/stdin-note.md');
        expect(saved).toContain('file payload for memory add');
    });

    it('should update and remove a memory', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        const addResult = runCli([
            'memory',
            'add',
            'project/to-update',
            '--content',
            'initial content',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });
        expectSuccess(addResult);

        const updateResult = runCli([
            'memory',
            'update',
            'project/to-update',
            '--content',
            'updated content',
            '--tags',
            'integration,test',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(updateResult, 'Updated memory project/to-update');

        const showResult = runCli([
            'memory',
            'show',
            'project/to-update',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(showResult);
        expect(showResult.output).toContain('content: updated content');

        const removeResult = runCli([
            'memory',
            'remove',
            'project/to-update',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectSuccess(removeResult, 'Removed memory project/to-update');

        const showAfterDelete = runCli([
            'memory',
            'show',
            'project/to-update',
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectFailure(showAfterDelete, 'Memory not found');
    });

    it('should fail when multiple content sources are provided', async () => {
        sandbox = await createIntegrationSandbox();
        await bootstrapDefaultStoreWithProjectCategory(sandbox);

        const fixturePath = join(sandbox.projectDir, 'memory-input.txt');
        await writeFile(fixturePath, 'content from file', 'utf8');

        const result = runCli([
            'memory',
            'add',
            'project/multi-source',
            '--content',
            'inline content',
            '--file',
            fixturePath,
        ], {
            env: sandbox.env,
            cwd: sandbox.projectDir,
        });

        expectFailure(result, 'Provide either --content, --file, or --stdin');
    });
});
