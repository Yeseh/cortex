import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect } from 'bun:test';

const CLI_ROOT = resolve(import.meta.dir, '..');
const CLI_ENTRY = resolve(CLI_ROOT, 'src/run.ts');

export interface CliRunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    output: string;
}

export interface CliRunOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdin?: string;
    timeoutMs?: number;
}

export interface IntegrationSandbox {
    rootDir: string;
    homeDir: string;
    projectDir: string;
    storeDir: string;
    env: NodeJS.ProcessEnv;
    cleanup: () => Promise<void>;
}

export const createIntegrationSandbox = async (): Promise<IntegrationSandbox> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'cortex-cli-int-'));
    const homeDir = join(rootDir, 'home');
    const projectDir = join(rootDir, 'project');
    const storeDir = join(rootDir, 'store-default');

    await mkdir(homeDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });
    await mkdir(storeDir, { recursive: true });

    const configDir = join(homeDir, '.config', 'cortex');
    // Do NOT pre-create config.yaml — tests that need it create it themselves

    const env: NodeJS.ProcessEnv = {
        ...process.env,
        HOME: homeDir,
        CORTEX_CONFIG_DIR: configDir,
    };

    return {
        rootDir,
        homeDir,
        projectDir,
        storeDir,
        env,
        cleanup: async () => {
            await rm(rootDir, { recursive: true, force: true });
        },
    };
};

export const runCli = (args: string[], options: CliRunOptions = {}): CliRunResult => {
    const result = spawnSync(process.execPath, [
        'run',
        CLI_ENTRY,
        ...args,
    ], {
        cwd: options.cwd ?? CLI_ROOT,
        env: options.env ?? process.env,
        input: options.stdin,
        encoding: 'utf8',
        timeout: options.timeoutMs ?? 30_000,
    });

    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';

    return {
        exitCode: result.status ?? 1,
        stdout,
        stderr,
        output: `${stdout}${stderr}`,
    };
};

export const expectSuccess = (result: CliRunResult, containsText?: string): void => {
    expect(result.exitCode).toBe(0);
    if (containsText) {
        expect(result.output).toContain(containsText);
    }
};

export const expectFailure = (result: CliRunResult, containsText?: string): void => {
    expect(result.exitCode).not.toBe(0);
    if (containsText) {
        expect(result.output).toContain(containsText);
    }
};

export const seedProjectCategory = async (storeDir: string): Promise<void> => {
    const projectDir = join(storeDir, 'project');
    await mkdir(projectDir, { recursive: true });

    await writeFile(
        join(storeDir, 'index.yaml'),
        'memories:\n  []\nsubcategories:\n  - path: project\n    memory_count: 0\n',
        'utf8',
    );

    await writeFile(
        join(projectDir, 'index.yaml'),
        'memories:\n  []\nsubcategories:\n  []\n',
        'utf8',
    );
};

export const bootstrapDefaultStoreWithProjectCategory = async (
    sandbox: IntegrationSandbox,
): Promise<void> => {
    await seedProjectCategory(sandbox.storeDir);
    const addResult = runCli([
        'store',
        'add',
        'default',
        sandbox.storeDir,
    ], {
        env: sandbox.env,
        cwd: sandbox.projectDir,
    });

    expectSuccess(addResult, 'name: default');
};

export const readMemoryFile = async (storeDir: string, relativePath: string): Promise<string> => {
    return readFile(join(storeDir, relativePath), 'utf8');
};
