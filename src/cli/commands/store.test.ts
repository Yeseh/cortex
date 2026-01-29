/**
 * Tests for the store init command
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { runStoreCommand, detectGitRepoName } from './store.ts';

const TEST_ROOT = join(import.meta.dir, '../../../.test-store-command');

/**
 * Runs git init in a directory to create a valid git repository.
 */
const runGitInit = (cwd: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const proc = spawn('git', ['init'], { cwd, shell: true });
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
    });
};

describe('store init command', () => {
    let tempDir: string;
    let registryPath: string;
    let cwd: string;
    // Isolated temp dir outside of any git repo (for git detection tests)
    let isolatedTempDir: string;

    beforeEach(async () => {
        await rm(TEST_ROOT, { recursive: true, force: true });
        await mkdir(TEST_ROOT, { recursive: true });
        tempDir = TEST_ROOT;
        registryPath = join(tempDir, 'stores.yaml');
        cwd = tempDir;
        // Create isolated temp dir outside of this repo for git detection tests
        isolatedTempDir = await mkdtemp(join(tmpdir(), 'cortex-store-test-'));
    });

    afterEach(async () => {
        await rm(TEST_ROOT, { recursive: true, force: true });
        await rm(isolatedTempDir, { recursive: true, force: true });
    });

    describe('detectGitRepoName', () => {
        test('returns repository name when in git repo', async () => {
            // Actually initialize a git repository
            const initResult = await runGitInit(isolatedTempDir);
            expect(initResult).toBe(true);

            const result = await detectGitRepoName(isolatedTempDir);
            // Should return the basename of isolatedTempDir
            expect(result).toBeTruthy();
        });

        test('returns null when not in git repo', async () => {
            // Use a fresh isolated dir that is definitely not in a git repo
            const result = await detectGitRepoName(isolatedTempDir);
            expect(result).toBe(null);
        });
    });

    describe('--name flag', () => {
        test('uses explicit name when provided', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'my-project',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.output.kind).toBe('store-init');
                if (result.value.output.kind === 'store-init') {
                    expect(result.value.output.value.name).toBe('my-project');
                }
            }
        });

        test('validates name format - rejects uppercase', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'INVALID_NAME',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        test('validates name format - rejects underscores', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'invalid_name',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        test('validates name format - accepts lowercase with hyphens', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'valid-name',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.output.kind).toBe('store-init');
                if (result.value.output.kind === 'store-init') {
                    expect(result.value.output.value.name).toBe('valid-name');
                }
            }
        });

        test('errors when not in git repo and no --name', async () => {
            // Use isolated temp dir that is definitely outside any git repo
            const isolatedRegistryPath = join(isolatedTempDir, 'stores.yaml');
            const result = await runStoreCommand({
                args: ['init'],
                cwd: isolatedTempDir,
                registryPath: isolatedRegistryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('GIT_REPO_REQUIRED');
            }
        });
    });

    describe('name collision', () => {
        test('errors when name already registered', async () => {
            // Pre-register a store
            const existingRegistry = 'stores:\n  my-project:\n    path: "/some/path"\n';
            await writeFile(registryPath, existingRegistry);

            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'my-project',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('STORE_ALREADY_EXISTS');
            }
        });

        test('allows different name when one is already registered', async () => {
            // Pre-register a store
            const existingRegistry = 'stores:\n  existing-store:\n    path: "/some/path"\n';
            await writeFile(registryPath, existingRegistry);

            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'new-store',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.output.kind).toBe('store-init');
                if (result.value.output.kind === 'store-init') {
                    expect(result.value.output.value.name).toBe('new-store');
                }
            }
        });
    });

    describe('registration', () => {
        test('registers store in global registry', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'test-store',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);

            // Verify registry was created
            const registryContent = await readFile(registryPath, 'utf8');
            expect(registryContent).toContain('test-store');
        });

        test('creates store directory with index.yaml', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'test-store',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok && result.value.output.kind === 'store-init') {
                const storePath = result.value.output.value.path;
                const indexPath = join(storePath, 'index.yaml');
                const indexStat = await stat(indexPath);
                expect(indexStat.isFile()).toBe(true);
            }
        });

        test('uses .cortex as default path when not specified', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'test-store',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok && result.value.output.kind === 'store-init') {
                expect(result.value.output.value.path).toContain('.cortex');
            }
        });

        test('uses custom path when provided', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    'custom-store-path',
                    '--name',
                    'test-store',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok && result.value.output.kind === 'store-init') {
                expect(result.value.output.value.path).toContain('custom-store-path');
            }
        });

        test('creates index.yaml with proper structure', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'test-store',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok && result.value.output.kind === 'store-init') {
                const storePath = result.value.output.value.path;
                const indexPath = join(storePath, 'index.yaml');
                const indexContent = await readFile(indexPath, 'utf8');
                expect(indexContent).toContain('memories:');
                expect(indexContent).toContain('subcategories:');
            }
        });
    });

    describe('output format', () => {
        test('returns store-init output with path and name', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'test-store',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.output.kind).toBe('store-init');
                if (result.value.output.kind === 'store-init') {
                    expect(result.value.output.value.path).toBeTruthy();
                    expect(result.value.output.value.name).toBe('test-store');
                }
            }
        });

        test('returns path as absolute path', async () => {
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'test-store',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok && result.value.output.kind === 'store-init') {
                const path = result.value.output.value.path;
                // Check that path is absolute (starts with drive letter on Windows or / on Unix)
                const isAbsolute = path.startsWith('/') || /^[a-zA-Z]:[/\\]/.test(path);
                expect(isAbsolute).toBe(true);
            }
        });
    });

    describe('git repo auto-detection', () => {
        test('auto-detects repo name from git', async () => {
            // Use the isolated temp dir and initialize a real git repo
            const initResult = await runGitInit(isolatedTempDir);
            expect(initResult).toBe(true);

            const isolatedRegistryPath = join(isolatedTempDir, 'stores.yaml');
            const result = await runStoreCommand({
                args: ['init'],
                cwd: isolatedTempDir,
                registryPath: isolatedRegistryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.output.kind).toBe('store-init');
                if (result.value.output.kind === 'store-init') {
                    // The name should be derived from the directory name
                    expect(result.value.output.value.name).toBeTruthy();
                }
            }
        });

        test('explicit --name overrides git detection', async () => {
            // Use the isolated temp dir and initialize a real git repo
            const initResult = await runGitInit(isolatedTempDir);
            expect(initResult).toBe(true);

            const isolatedRegistryPath = join(isolatedTempDir, 'stores.yaml');
            const result = await runStoreCommand({
                args: [
                    'init',
                    '--name',
                    'custom-name',
                ],
                cwd: isolatedTempDir,
                registryPath: isolatedRegistryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok && result.value.output.kind === 'store-init') {
                expect(result.value.output.value.name).toBe('custom-name');
            }
        });
    });

    describe('command validation', () => {
        test('rejects unknown subcommand', async () => {
            const result = await runStoreCommand({
                args: ['unknown'],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('INVALID_COMMAND');
            }
        });

        test('requires a command', async () => {
            const result = await runStoreCommand({
                args: [],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('INVALID_COMMAND');
            }
        });
    });

    describe('store list command', () => {
        test('lists registered stores', async () => {
            // Pre-register some stores
            const existingRegistry = 'stores:\n  store-a:\n    path: "/path/a"\n  store-b:\n    path: "/path/b"\n';
            await writeFile(registryPath, existingRegistry);

            const result = await runStoreCommand({
                args: ['list'],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.output.kind).toBe('store-registry');
                if (result.value.output.kind === 'store-registry') {
                    expect(result.value.output.value.stores).toHaveLength(2);
                }
            }
        });

        test('returns empty list when no stores registered', async () => {
            const result = await runStoreCommand({
                args: ['list'],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.output.kind).toBe('store-registry');
                if (result.value.output.kind === 'store-registry') {
                    expect(result.value.output.value.stores).toHaveLength(0);
                }
            }
        });
    });

    describe('store add command', () => {
        test('adds a store to registry', async () => {
            const result = await runStoreCommand({
                args: [
                    'add',
                    'new-store',
                    '/some/path',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.output.kind).toBe('store');
                if (result.value.output.kind === 'store') {
                    expect(result.value.output.value.name).toBe('new-store');
                }
            }

            // Verify registry was updated
            const registryContent = await readFile(registryPath, 'utf8');
            expect(registryContent).toContain('new-store');
        });

        test('requires name and path', async () => {
            const result = await runStoreCommand({
                args: [
                    'add', 'only-name',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('INVALID_COMMAND');
            }
        });

        test('validates store name', async () => {
            const result = await runStoreCommand({
                args: [
                    'add',
                    'INVALID',
                    '/some/path',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('INVALID_STORE_NAME');
            }
        });

        test('rejects duplicate store names', async () => {
            // Pre-register a store
            const existingRegistry = 'stores:\n  existing:\n    path: "/some/path"\n';
            await writeFile(registryPath, existingRegistry);

            const result = await runStoreCommand({
                args: [
                    'add',
                    'existing',
                    '/other/path',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('STORE_ALREADY_EXISTS');
            }
        });
    });

    describe('store remove command', () => {
        test('removes a store from registry', async () => {
            // Pre-register stores
            const existingRegistry = 'stores:\n  to-remove:\n    path: "/path/a"\n  to-keep:\n    path: "/path/b"\n';
            await writeFile(registryPath, existingRegistry);

            const result = await runStoreCommand({
                args: [
                    'remove', 'to-remove',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.output.kind).toBe('store');
                if (result.value.output.kind === 'store') {
                    expect(result.value.output.value.name).toBe('to-remove');
                }
            }

            // Verify registry was updated
            const registryContent = await readFile(registryPath, 'utf8');
            expect(registryContent).not.toContain('to-remove');
            expect(registryContent).toContain('to-keep');
        });

        test('requires store name', async () => {
            const result = await runStoreCommand({
                args: ['remove'],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('INVALID_COMMAND');
            }
        });

        test('errors when store not registered', async () => {
            const result = await runStoreCommand({
                args: [
                    'remove', 'nonexistent',
                ],
                cwd,
                registryPath,
            });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('STORE_REGISTRY_FAILED');
            }
        });
    });
});
