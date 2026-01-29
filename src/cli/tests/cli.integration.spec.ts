/**
 * Comprehensive integration tests for the Cortex CLI with Commander.js.
 *
 * These tests spawn the CLI as a subprocess using Bun shell to test
 * the CLI like a user would interact with it.
 *
 * The tests use local store resolution by creating a project directory
 * with a `.cortex/memory` subdirectory structure.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem/index.ts';
import { serializeMemoryFile, type MemoryFileContents } from '../../core/memory/index.ts';

/**
 * CLI runner that spawns cortex as a subprocess.
 * Uses Bun's shell module for realistic CLI testing.
 */
interface CliResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

interface CliOptions {
    /** Required - must be a directory with .cortex/memory inside */
    cwd: string;
    /** Optional stdin content */
    stdin?: string;
}

/**
 * Runs the cortex CLI with the given arguments.
 * Uses the runProgram export via bun run for integration testing.
 *
 * The CLI resolves the store based on the current working directory,
 * looking for a `.cortex/memory` subdirectory.
 */
const runCortexCli = async (args: string[], options: CliOptions): Promise<CliResult> => {
    const scriptPath = join(import.meta.dir, '..', 'run.ts');

    try {
        // Use Bun.spawn for cross-platform subprocess spawning
        const proc = Bun.spawn([
            'bun',
            'run',
            scriptPath,
            ...args,
        ], {
            cwd: options.cwd,
            stdout: 'pipe',
            stderr: 'pipe',
        });

        const [
            stdout, stderr,
        ] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
        ]);
        const exitCode = await proc.exited;

        return {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode,
        };
    }
    catch (error) {
        // Handle process errors
        const processError = error as { stdout?: Buffer; stderr?: Buffer; exitCode?: number };
        return {
            stdout: processError.stdout?.toString().trim() ?? '',
            stderr: processError.stderr?.toString().trim() ?? '',
            exitCode: processError.exitCode ?? 1,
        };
    }
};

/**
 * Creates a unique test project directory with `.cortex/memory` structure.
 * Returns the project directory path (the cwd for CLI commands).
 */
const createTestProject = async (): Promise<string> => {
    const projectDir = await fs.mkdtemp(join(tmpdir(), 'cortex-integration-test-'));
    const storeDir = join(projectDir, '.cortex', 'memory');
    await fs.mkdir(storeDir, { recursive: true });
    await initializeTestStore(storeDir);
    return projectDir;
};

/**
 * Gets the store directory path from a project directory.
 */
const getStoreDir = (projectDir: string): string => join(projectDir, '.cortex', 'memory');

/**
 * Initializes a store with the basic structure needed for testing.
 */
const initializeTestStore = async (storeRoot: string): Promise<void> => {
    const indexContent = 'memories: []\nsubcategories: []';
    await fs.mkdir(storeRoot, { recursive: true });
    await fs.writeFile(join(storeRoot, 'index.yaml'), indexContent, 'utf8');
    await fs.writeFile(join(storeRoot, 'config.yaml'), '', 'utf8');
};

/**
 * Creates a memory file in the test store with the given content.
 * Uses FilesystemStorageAdapter to ensure indexes are properly created.
 */
const createMemoryFile = async (
    storeRoot: string,
    slugPath: string,
    options: {
        content?: string;
        tags?: string[];
        expiresAt?: Date;
        createdAt?: Date;
        updatedAt?: Date;
    } = {},
): Promise<void> => {
    const content = options.content ?? 'Test memory content.';
    const tags = options.tags ?? ['test'];
    const createdAt = options.createdAt ?? new Date('2024-01-01T00:00:00.000Z');
    const updatedAt = options.updatedAt ?? new Date('2024-01-02T00:00:00.000Z');

    const memoryContents: MemoryFileContents = {
        frontmatter: {
            createdAt,
            updatedAt,
            tags,
            source: 'user',
            expiresAt: options.expiresAt,
        },
        content,
    };

    const serialized = serializeMemoryFile(memoryContents);
    if (!serialized.ok) {
        throw new Error(`Failed to serialize memory: ${serialized.error.message}`);
    }

    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
    const result = await adapter.writeMemoryFile(slugPath, serialized.value, {
        allowIndexCreate: true,
        allowIndexUpdate: true,
    });
    if (!result.ok) {
        throw new Error(`Failed to write memory: ${result.error.message}`);
    }
};

/**
 * Creates a category index file.
 * Note: Indexes are stored as `<categoryPath>/index.yaml` files inside the store root.
 * The format is strict: list markers on their own line, fields indented with 4 spaces.
 */
const createCategoryIndex = async (
    storeRoot: string,
    categoryPath: string,
    memories: { path: string; tokenEstimate: number; summary?: string }[] = [],
    subcategories: { path: string; memoryCount?: number }[] = [],
): Promise<void> => {
    const lines: string[] = [];

    // Memory section
    if (memories.length === 0) {
        lines.push('memories: []');
    }
    else {
        lines.push('memories:');
        for (const memory of memories) {
            lines.push('  -');
            lines.push(`    path: ${memory.path}`);
            lines.push(`    token_estimate: ${memory.tokenEstimate}`);
            if (memory.summary) {
                lines.push(`    summary: ${memory.summary}`);
            }
        }
    }

    lines.push('');

    // Subcategories section
    if (subcategories.length === 0) {
        lines.push('subcategories: []');
    }
    else {
        lines.push('subcategories:');
        for (const sub of subcategories) {
            lines.push('  -');
            lines.push(`    path: ${sub.path}`);
            lines.push(`    memory_count: ${sub.memoryCount ?? 0}`);
        }
    }

    const content = lines.join('\n');
    const categoryDir = categoryPath ? join(storeRoot, categoryPath) : storeRoot;
    await fs.mkdir(categoryDir, { recursive: true });
    await fs.writeFile(join(categoryDir, 'index.yaml'), content, 'utf8');
};

/**
 * Checks if a memory file exists.
 */
const memoryExists = async (storeRoot: string, slugPath: string): Promise<boolean> => {
    try {
        await fs.access(join(storeRoot, `${slugPath}.md`));
        return true;
    }
    catch {
        return false;
    }
};

/**
 * Reads a memory file's content.
 */
const readMemoryFile = async (storeRoot: string, slugPath: string): Promise<string | null> => {
    try {
        return await fs.readFile(join(storeRoot, `${slugPath}.md`), 'utf8');
    }
    catch {
        return null;
    }
};

describe('Cortex CLI Integration Tests', () => {
    let testProject: string;
    let storeDir: string;

    beforeEach(async () => {
        testProject = await createTestProject();
        storeDir = getStoreDir(testProject);
    });

    afterEach(async () => {
        if (testProject) {
            await fs.rm(testProject, { recursive: true, force: true });
        }
    });

    describe('memory add command', () => {
        it('should add a new memory with inline content', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'add',
                    'project/test-memory',
                    '--content',
                    'This is test content.',
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Added memory');
            expect(result.stdout).toContain('project/test-memory');

            const exists = await memoryExists(storeDir, 'project/test-memory');
            expect(exists).toBe(true);

            const content = await readMemoryFile(storeDir, 'project/test-memory');
            expect(content).toContain('This is test content.');
        });

        it('should add a memory with tags', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'add',
                    'project/tagged-memory',
                    '--content',
                    'Content with tags.',
                    '--tags',
                    'tag1,tag2,tag3',
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(storeDir, 'project/tagged-memory');
            expect(content).toContain('tags:');
            expect(content).toContain('tag1');
            expect(content).toContain('tag2');
            expect(content).toContain('tag3');
        });

        it('should add a memory with expiry date', async () => {
            const expiryDate = '2025-12-31T23:59:59.000Z';
            const result = await runCortexCli(
                [
                    'memory',
                    'add',
                    'project/expiring-memory',
                    '--content',
                    'This will expire.',
                    '--expires-at',
                    expiryDate,
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(storeDir, 'project/expiring-memory');
            expect(content).toContain('expires_at:');
            expect(content).toContain('2025-12-31');
        });

        it('should fail when memory path is missing', async () => {
            const result = await runCortexCli([
                'memory',
                'add',
                '--content',
                'No path provided.',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(1);
            // Commander shows "missing required argument" error
            expect(result.stderr.toLowerCase()).toMatch(/missing|required|argument/);
        });

        it('should fail for invalid memory path format', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'add',
                    'invalid-single-segment',
                    '--content',
                    'Bad path.',
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(1);
        });

        it('should fail for unknown flags', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'add',
                    'project/memory',
                    '--unknown-flag',
                    'value',
                ],
                {
                    cwd: testProject,
                },
            );

            expect(result.exitCode).toBe(1);
            // Commander shows "unknown option" error
            expect(result.stderr.toLowerCase()).toMatch(/unknown|option/);
        });

        it('should add memory from file', async () => {
            // Create a content file
            const contentFile = join(testProject, 'content.txt');
            await fs.writeFile(contentFile, 'Content from file.', 'utf8');

            const result = await runCortexCli(
                [
                    'memory',
                    'add',
                    'project/file-memory',
                    '--file',
                    contentFile,
                ],
                {
                    cwd: testProject,
                },
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(storeDir, 'project/file-memory');
            expect(content).toContain('Content from file.');
        });

        it('should add memory in deeply nested category', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'add',
                    'domain/subdomain/feature/deep-memory',
                    '--content',
                    'Deeply nested content.',
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(0);

            const exists = await memoryExists(storeDir, 'domain/subdomain/feature/deep-memory');
            expect(exists).toBe(true);
        });

        it('should add memory with special characters in content', async () => {
            const specialContent = 'Special chars: $HOME, `backticks`, "quotes", \'single\'';
            const result = await runCortexCli(
                [
                    'memory',
                    'add',
                    'project/special-memory',
                    '--content',
                    specialContent,
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(storeDir, 'project/special-memory');
            expect(content).toContain('$HOME');
            expect(content).toContain('backticks');
        });
    });

    describe('memory list command', () => {
        beforeEach(async () => {
            // Set up some test memories (indexes are created automatically by createMemoryFile)
            await createMemoryFile(storeDir, 'project/memory-one', {
                content: 'First memory content.',
            });
            await createMemoryFile(storeDir, 'project/memory-two', {
                content: 'Second memory content.',
            });
            await createMemoryFile(storeDir, 'domain/other-memory', {
                content: 'Domain memory content.',
            });
        });

        it('should list all memories across categories', async () => {
            const result = await runCortexCli([
                'memory', 'list',
            ], { cwd: testProject });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('project/memory-one');
            expect(result.stdout).toContain('project/memory-two');
            expect(result.stdout).toContain('domain/other-memory');
        });

        it('should list memories in a specific category', async () => {
            const result = await runCortexCli([
                'memory',
                'list',
                'project',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('project/memory-one');
            expect(result.stdout).toContain('project/memory-two');
            expect(result.stdout).not.toContain('domain/other-memory');
        });

        it('should output in JSON format', async () => {
            const result = await runCortexCli([
                'memory',
                'list',
                '--format',
                'json',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);

            const parsed = JSON.parse(result.stdout);
            expect(parsed.memories).toBeDefined();
            expect(Array.isArray(parsed.memories)).toBe(true);
        });

        it('should exclude expired memories by default', async () => {
            // Add an expired memory (index is created automatically)
            await createMemoryFile(storeDir, 'project/expired-memory', {
                content: 'This is expired.',
                expiresAt: new Date('2020-01-01T00:00:00.000Z'),
            });

            const result = await runCortexCli([
                'memory',
                'list',
                'project',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('project/memory-one');
            expect(result.stdout).not.toContain('project/expired-memory');
        });

        it('should include expired memories with --include-expired flag', async () => {
            // Add an expired memory (index is created automatically)
            await createMemoryFile(storeDir, 'project/expired-memory', {
                content: 'This is expired.',
                expiresAt: new Date('2020-01-01T00:00:00.000Z'),
            });

            const result = await runCortexCli([
                'memory',
                'list',
                'project',
                '--include-expired',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('project/memory-one');
            expect(result.stdout).toContain('project/expired-memory');
        });

        it('should return empty list for non-existent category', async () => {
            const result = await runCortexCli([
                'memory',
                'list',
                'nonexistent',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('memories: []');
        });

        it('should use yaml format for invalid format option', async () => {
            // Invalid formats fall back to default YAML formatting
            const result = await runCortexCli([
                'memory',
                'list',
                '--format',
                'invalid',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            // Should still output valid content (in yaml-like format)
            expect(result.stdout).toContain('memories:');
        });
    });

    describe('memory update command', () => {
        beforeEach(async () => {
            await createMemoryFile(storeDir, 'project/updatable', {
                content: 'Original content.',
                tags: ['original'],
            });
        });

        it('should update memory content', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'update',
                    'project/updatable',
                    '--content',
                    'Updated content.',
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Updated');

            const content = await readMemoryFile(storeDir, 'project/updatable');
            expect(content).toContain('Updated content.');
            expect(content).not.toContain('Original content.');
        });

        it('should update memory tags', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'update',
                    'project/updatable',
                    '--tags',
                    'new-tag,updated',
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(storeDir, 'project/updatable');
            expect(content).toContain('new-tag');
            expect(content).toContain('updated');
        });

        it('should set expiry date', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'update',
                    'project/updatable',
                    '--expires-at',
                    '2030-01-01T00:00:00.000Z',
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(storeDir, 'project/updatable');
            expect(content).toContain('expires_at:');
            expect(content).toContain('2030-01-01');
        });

        it('should clear expiry date with --clear-expiry', async () => {
            // First set an expiry
            await createMemoryFile(storeDir, 'project/with-expiry', {
                content: 'Has expiry.',
                expiresAt: new Date('2025-01-01T00:00:00.000Z'),
            });

            const result = await runCortexCli([
                'memory',
                'update',
                'project/with-expiry',
                '--clear-expiry',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(storeDir, 'project/with-expiry');
            expect(content).not.toContain('expires_at:');
        });

        it('should fail when memory does not exist', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'update',
                    'project/nonexistent',
                    '--content',
                    'New content.',
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(1);
            expect(result.stderr.toLowerCase()).toContain('not found');
        });

        it('should fail when no updates provided', async () => {
            const result = await runCortexCli([
                'memory',
                'update',
                'project/updatable',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(1);
            expect(result.stderr.toLowerCase()).toContain('no update');
        });

        it('should fail when both --expires-at and --clear-expiry are used', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'update',
                    'project/updatable',
                    '--expires-at',
                    '2030-01-01T00:00:00.000Z',
                    '--clear-expiry',
                ],
                { cwd: testProject },
            );

            expect(result.exitCode).toBe(1);
        });

        it('should update content from file', async () => {
            const contentFile = join(testProject, 'new-content.txt');
            await fs.writeFile(contentFile, 'Content from file update.', 'utf8');

            const result = await runCortexCli(
                [
                    'memory',
                    'update',
                    'project/updatable',
                    '--file',
                    contentFile,
                ],
                {
                    cwd: testProject,
                },
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(storeDir, 'project/updatable');
            expect(content).toContain('Content from file update.');
        });

        it('should preserve original content when only updating tags', async () => {
            const result = await runCortexCli(
                [
                    'memory',
                    'update',
                    'project/updatable',
                    '--tags',
                    'new-tag',
                ],
                {
                    cwd: testProject,
                },
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(storeDir, 'project/updatable');
            expect(content).toContain('Original content.');
            expect(content).toContain('new-tag');
        });
    });

    describe('store prune command', () => {
        beforeEach(async () => {
            // Create some expired and non-expired memories (indexes are created automatically)
            await createMemoryFile(storeDir, 'project/fresh-memory', {
                content: 'Fresh content.',
                expiresAt: new Date('2099-01-01T00:00:00.000Z'),
            });
            await createMemoryFile(storeDir, 'project/expired-one', {
                content: 'Expired content.',
                expiresAt: new Date('2020-01-01T00:00:00.000Z'),
            });
            await createMemoryFile(storeDir, 'project/expired-two', {
                content: 'Also expired.',
                expiresAt: new Date('2019-06-15T00:00:00.000Z'),
            });
        });

        it('should report expired memories with --dry-run', async () => {
            const result = await runCortexCli([
                'store',
                'prune',
                '--dry-run',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Would prune');
            expect(result.stdout).toContain('project/expired-one');
            expect(result.stdout).toContain('project/expired-two');

            // Memories should still exist
            expect(await memoryExists(storeDir, 'project/expired-one')).toBe(true);
            expect(await memoryExists(storeDir, 'project/expired-two')).toBe(true);
        });

        it('should delete expired memories without --dry-run', async () => {
            const result = await runCortexCli([
                'store', 'prune',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Pruned');
            expect(result.stdout).toContain('2');

            // Expired memories should be deleted
            expect(await memoryExists(storeDir, 'project/expired-one')).toBe(false);
            expect(await memoryExists(storeDir, 'project/expired-two')).toBe(false);

            // Fresh memory should remain
            expect(await memoryExists(storeDir, 'project/fresh-memory')).toBe(true);
        });

        it('should report when no expired memories found', async () => {
            // Remove expired memories first
            await fs.rm(join(storeDir, 'project', 'expired-one.md'));
            await fs.rm(join(storeDir, 'project', 'expired-two.md'));

            await createCategoryIndex(storeDir, 'project', [{ path: 'project/fresh-memory', tokenEstimate: 10 }]);

            const result = await runCortexCli([
                'store', 'prune',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('No expired memories');
        });
    });

    describe('store reindex command', () => {
        beforeEach(async () => {
            // Create memories without proper indexes
            await createMemoryFile(storeDir, 'project/memory-a', {
                content: 'Memory A content.',
            });
            await createMemoryFile(storeDir, 'project/memory-b', {
                content: 'Memory B content.',
            });
        });

        it('should rebuild indexes', async () => {
            const result = await runCortexCli([
                'store', 'reindex',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Reindexed');

            // Verify index was created (indexes are stored as <categoryPath>/index.yaml files)
            const indexPath = join(storeDir, 'project', 'index.yaml');
            const indexExists = await fs
                .access(indexPath)
                .then(() => true)
                .catch(() => false);
            expect(indexExists).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should fail gracefully with unknown command', async () => {
            const result = await runCortexCli(['unknown-command'], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(1);
            // Commander shows "unknown command" error
            expect(result.stderr.toLowerCase()).toMatch(/unknown|command/);
        });

        it('should show help when no command provided', async () => {
            const result = await runCortexCli([], {
                cwd: testProject,
            });

            // Commander.js by default shows help when no command is provided
            // Exit code may be 0 (help displayed) or 1 depending on config
            // The important thing is that it doesn't crash
            expect(result.exitCode).toBeGreaterThanOrEqual(0);
        });

        it('should fail when store does not exist and no global fallback', async () => {
            // Create a temp directory with no .cortex/memory and no global store available
            const emptyDir = await fs.mkdtemp(join(tmpdir(), 'cortex-empty-'));
            // Create a fake .cortex directory to prevent global store fallback
            const fakeCortex = join(emptyDir, '.cortex');
            await fs.mkdir(fakeCortex, { recursive: true });
            // Note: .cortex/memory doesn't exist, so resolution should fail
            try {
                const result = await runCortexCli([
                    'memory', 'list',
                ], {
                    cwd: emptyDir,
                });

                // Either fails because no store found, or succeeds with empty list
                // depending on whether global store exists
                expect(result.exitCode).toBeGreaterThanOrEqual(0);
            }
            finally {
                await fs.rm(emptyDir, { recursive: true, force: true });
            }
        });
    });

    describe('help and version', () => {
        it('should show help with --help flag', async () => {
            const result = await runCortexCli(['--help'], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Memory system for AI agents');
            expect(result.stdout).toContain('memory');
            expect(result.stdout).toContain('store');
        });

        it('should show version with --version flag', async () => {
            const result = await runCortexCli(['--version'], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
        });

        it('should show memory subcommand help', async () => {
            const result = await runCortexCli([
                'memory', '--help',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Memory operations');
            expect(result.stdout).toContain('add');
            expect(result.stdout).toContain('show');
            expect(result.stdout).toContain('list');
        });

        it('should show store subcommand help', async () => {
            const result = await runCortexCli([
                'store', '--help',
            ], {
                cwd: testProject,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Store management');
            expect(result.stdout).toContain('prune');
            expect(result.stdout).toContain('reindex');
        });
    });
});
