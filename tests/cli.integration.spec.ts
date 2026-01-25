/**
 * Comprehensive integration tests for the Cortex CLI.
 *
 * These tests spawn the CLI as a subprocess using Bun shell to test
 * the CLI like a user would interact with it.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    cwd?: string;
    globalStorePath?: string;
    stdin?: string;
}

/**
 * Runs the cortex CLI with the given arguments.
 * Uses the runCli export directly via bun run for integration testing.
 */
const runCortexCli = async (args: string[], options: CliOptions = {}): Promise<CliResult> => {
    const cwd = options.cwd ?? process.cwd();
    const globalStoreFlag = options.globalStorePath
        ? ['--global-store', options.globalStorePath]
        : [];

    const allArgs = [...globalStoreFlag, ...args];
    const scriptPath = join(import.meta.dir, '..', 'src', 'cli', 'run.ts');

    try {
        // Use Bun.spawn for cross-platform subprocess spawning
        const proc = Bun.spawn(['bun', 'run', scriptPath, ...allArgs], {
            cwd,
            stdout: 'pipe',
            stderr: 'pipe',
        });

        const [stdout, stderr] = await Promise.all([
            new Response(proc.stdout).text(),
            new Response(proc.stderr).text(),
        ]);
        const exitCode = await proc.exited;

        return {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode,
        };
    } catch (error) {
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
 * Creates a unique test store directory that is automatically
 * cleaned up after each test.
 */
const createTestStore = async (): Promise<string> => {
    const storeDir = await fs.mkdtemp(join(tmpdir(), 'cortex-integration-test-'));
    return storeDir;
};

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
    } = {}
): Promise<void> => {
    const content = options.content ?? 'Test memory content.';
    const tags = options.tags ?? ['test'];
    const createdAt = options.createdAt ?? new Date('2024-01-01T00:00:00.000Z');
    const updatedAt = options.updatedAt ?? new Date('2024-01-02T00:00:00.000Z');

    const frontmatter = [
        '---',
        `created_at: ${createdAt.toISOString()}`,
        `updated_at: ${updatedAt.toISOString()}`,
        `tags: [${tags.join(', ')}]`,
        'source: user',
    ];

    if (options.expiresAt) {
        frontmatter.push(`expires_at: ${options.expiresAt.toISOString()}`);
    }

    frontmatter.push('---');
    frontmatter.push(content);

    const fileContent = frontmatter.join('\n');
    const memoryDir = join(storeRoot, 'memories', ...slugPath.split('/').slice(0, -1));
    await fs.mkdir(memoryDir, { recursive: true });
    const filePath = join(storeRoot, 'memories', `${slugPath}.md`);
    await fs.writeFile(filePath, fileContent, 'utf8');
};

/**
 * Creates a category index file.
 * Note: Indexes are stored as `indexes/<category>.yml` files.
 * The format is strict: list markers on their own line, fields indented with 4 spaces.
 */
const createCategoryIndex = async (
    storeRoot: string,
    categoryPath: string,
    memories: Array<{ path: string; tokenEstimate: number; summary?: string }> = [],
    subcategories: Array<{ path: string; memoryCount?: number }> = []
): Promise<void> => {
    const lines: string[] = [];

    // Memory section
    if (memories.length === 0) {
        lines.push('memories: []');
    } else {
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
    } else {
        lines.push('subcategories:');
        for (const sub of subcategories) {
            lines.push('  -');
            lines.push(`    path: ${sub.path}`);
            lines.push(`    memory_count: ${sub.memoryCount ?? 0}`);
        }
    }

    const content = lines.join('\n');
    const indexDir = join(storeRoot, 'indexes');
    await fs.mkdir(indexDir, { recursive: true });
    await fs.writeFile(join(indexDir, `${categoryPath}.yml`), content, 'utf8');
};

/**
 * Checks if a memory file exists.
 */
const memoryExists = async (storeRoot: string, slugPath: string): Promise<boolean> => {
    try {
        await fs.access(join(storeRoot, 'memories', `${slugPath}.md`));
        return true;
    } catch {
        return false;
    }
};

/**
 * Reads a memory file's content.
 */
const readMemoryFile = async (storeRoot: string, slugPath: string): Promise<string | null> => {
    try {
        return await fs.readFile(join(storeRoot, 'memories', `${slugPath}.md`), 'utf8');
    } catch {
        return null;
    }
};

describe('Cortex CLI Integration Tests', () => {
    let testStore: string;

    beforeEach(async () => {
        testStore = await createTestStore();
        await initializeTestStore(testStore);
    });

    afterEach(async () => {
        if (testStore) {
            await fs.rm(testStore, { recursive: true, force: true });
        }
    });

    describe('add command', () => {
        it('should add a new memory with inline content', async () => {
            const result = await runCortexCli(
                ['add', 'project/test-memory', '--content', 'This is test content.'],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Added memory');
            expect(result.stdout).toContain('project/test-memory');

            const exists = await memoryExists(testStore, 'project/test-memory');
            expect(exists).toBe(true);

            const content = await readMemoryFile(testStore, 'project/test-memory');
            expect(content).toContain('This is test content.');
        });

        it('should add a memory with tags', async () => {
            const result = await runCortexCli(
                [
                    'add',
                    'project/tagged-memory',
                    '--content',
                    'Content with tags.',
                    '--tags',
                    'tag1,tag2,tag3',
                ],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(testStore, 'project/tagged-memory');
            expect(content).toContain('tags:');
            expect(content).toContain('tag1');
            expect(content).toContain('tag2');
            expect(content).toContain('tag3');
        });

        it('should add a memory with expiry date', async () => {
            const expiryDate = '2025-12-31T23:59:59.000Z';
            const result = await runCortexCli(
                [
                    'add',
                    'project/expiring-memory',
                    '--content',
                    'This will expire.',
                    '--expires-at',
                    expiryDate,
                ],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(testStore, 'project/expiring-memory');
            expect(content).toContain('expires_at:');
            expect(content).toContain('2025-12-31');
        });

        it('should fail when memory path is missing', async () => {
            const result = await runCortexCli(['add', '--content', 'No path provided.'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('required');
        });

        it('should fail for invalid memory path format', async () => {
            const result = await runCortexCli(
                ['add', 'invalid-single-segment', '--content', 'Bad path.'],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(1);
        });

        it('should fail for unknown flags', async () => {
            const result = await runCortexCli(
                ['add', 'project/memory', '--unknown-flag', 'value'],
                {
                    globalStorePath: testStore,
                }
            );

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('Unknown flag');
        });

        it('should add memory from file', async () => {
            // Create a content file
            const contentFile = join(testStore, 'content.txt');
            await fs.writeFile(contentFile, 'Content from file.', 'utf8');

            const result = await runCortexCli(
                ['add', 'project/file-memory', '--file', contentFile],
                {
                    globalStorePath: testStore,
                }
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(testStore, 'project/file-memory');
            expect(content).toContain('Content from file.');
        });

        it('should add memory in deeply nested category', async () => {
            const result = await runCortexCli(
                [
                    'add',
                    'domain/subdomain/feature/deep-memory',
                    '--content',
                    'Deeply nested content.',
                ],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(0);

            const exists = await memoryExists(testStore, 'domain/subdomain/feature/deep-memory');
            expect(exists).toBe(true);
        });

        it('should add memory with special characters in content', async () => {
            const specialContent = 'Special chars: $HOME, `backticks`, "quotes", \'single\'';
            const result = await runCortexCli(
                ['add', 'project/special-memory', '--content', specialContent],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(testStore, 'project/special-memory');
            expect(content).toContain('$HOME');
            expect(content).toContain('backticks');
        });
    });

    describe('list command', () => {
        beforeEach(async () => {
            // Set up some test memories
            await createMemoryFile(testStore, 'project/memory-one', {
                content: 'First memory content.',
            });
            await createMemoryFile(testStore, 'project/memory-two', {
                content: 'Second memory content.',
            });
            await createMemoryFile(testStore, 'domain/other-memory', {
                content: 'Domain memory content.',
            });

            // Create indexes for the memories
            await createCategoryIndex(testStore, 'project', [
                { path: 'project/memory-one', tokenEstimate: 10 },
                { path: 'project/memory-two', tokenEstimate: 15 },
            ]);
            await createCategoryIndex(testStore, 'domain', [
                { path: 'domain/other-memory', tokenEstimate: 12 },
            ]);
        });

        it('should list all memories across categories', async () => {
            const result = await runCortexCli(['list'], { globalStorePath: testStore });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('project/memory-one');
            expect(result.stdout).toContain('project/memory-two');
            expect(result.stdout).toContain('domain/other-memory');
        });

        it('should list memories in a specific category', async () => {
            const result = await runCortexCli(['list', 'project'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('project/memory-one');
            expect(result.stdout).toContain('project/memory-two');
            expect(result.stdout).not.toContain('domain/other-memory');
        });

        it('should output in JSON format', async () => {
            const result = await runCortexCli(['list', '--format', 'json'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);

            const parsed = JSON.parse(result.stdout);
            expect(parsed.memories).toBeDefined();
            expect(Array.isArray(parsed.memories)).toBe(true);
        });

        it('should exclude expired memories by default', async () => {
            // Add an expired memory
            await createMemoryFile(testStore, 'project/expired-memory', {
                content: 'This is expired.',
                expiresAt: new Date('2020-01-01T00:00:00.000Z'),
            });

            await createCategoryIndex(testStore, 'project', [
                { path: 'project/memory-one', tokenEstimate: 10 },
                { path: 'project/expired-memory', tokenEstimate: 5 },
            ]);

            const result = await runCortexCli(['list', 'project'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('project/memory-one');
            expect(result.stdout).not.toContain('project/expired-memory');
        });

        it('should include expired memories with --include-expired flag', async () => {
            // Add an expired memory
            await createMemoryFile(testStore, 'project/expired-memory', {
                content: 'This is expired.',
                expiresAt: new Date('2020-01-01T00:00:00.000Z'),
            });

            await createCategoryIndex(testStore, 'project', [
                { path: 'project/memory-one', tokenEstimate: 10 },
                { path: 'project/expired-memory', tokenEstimate: 5 },
            ]);

            const result = await runCortexCli(['list', 'project', '--include-expired'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('project/memory-one');
            expect(result.stdout).toContain('project/expired-memory');
        });

        it('should return empty list for non-existent category', async () => {
            const result = await runCortexCli(['list', 'nonexistent'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('memories: []');
        });

        it('should fail for invalid format option', async () => {
            const result = await runCortexCli(['list', '--format', 'invalid'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(1);
        });
    });

    describe('update command', () => {
        beforeEach(async () => {
            await createMemoryFile(testStore, 'project/updatable', {
                content: 'Original content.',
                tags: ['original'],
            });
        });

        it('should update memory content', async () => {
            const result = await runCortexCli(
                ['update', 'project/updatable', '--content', 'Updated content.'],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Updated');

            const content = await readMemoryFile(testStore, 'project/updatable');
            expect(content).toContain('Updated content.');
            expect(content).not.toContain('Original content.');
        });

        it('should update memory tags', async () => {
            const result = await runCortexCli(
                ['update', 'project/updatable', '--tags', 'new-tag,updated'],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(testStore, 'project/updatable');
            expect(content).toContain('new-tag');
            expect(content).toContain('updated');
        });

        it('should set expiry date', async () => {
            const result = await runCortexCli(
                ['update', 'project/updatable', '--expires-at', '2030-01-01T00:00:00.000Z'],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(testStore, 'project/updatable');
            expect(content).toContain('expires_at:');
            expect(content).toContain('2030-01-01');
        });

        it('should clear expiry date with --clear-expiry', async () => {
            // First set an expiry
            await createMemoryFile(testStore, 'project/with-expiry', {
                content: 'Has expiry.',
                expiresAt: new Date('2025-01-01T00:00:00.000Z'),
            });

            const result = await runCortexCli(['update', 'project/with-expiry', '--clear-expiry'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(testStore, 'project/with-expiry');
            expect(content).not.toContain('expires_at:');
        });

        it('should fail when memory does not exist', async () => {
            const result = await runCortexCli(
                ['update', 'project/nonexistent', '--content', 'New content.'],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('not found');
        });

        it('should fail when no updates provided', async () => {
            const result = await runCortexCli(['update', 'project/updatable'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('No updates provided');
        });

        it('should fail when both --expires-at and --clear-expiry are used', async () => {
            const result = await runCortexCli(
                [
                    'update',
                    'project/updatable',
                    '--expires-at',
                    '2030-01-01T00:00:00.000Z',
                    '--clear-expiry',
                ],
                { globalStorePath: testStore }
            );

            expect(result.exitCode).toBe(1);
        });

        it('should update content from file', async () => {
            const contentFile = join(testStore, 'new-content.txt');
            await fs.writeFile(contentFile, 'Content from file update.', 'utf8');

            const result = await runCortexCli(
                ['update', 'project/updatable', '--file', contentFile],
                {
                    globalStorePath: testStore,
                }
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(testStore, 'project/updatable');
            expect(content).toContain('Content from file update.');
        });

        it('should preserve original content when only updating tags', async () => {
            const result = await runCortexCli(
                ['update', 'project/updatable', '--tags', 'new-tag'],
                {
                    globalStorePath: testStore,
                }
            );

            expect(result.exitCode).toBe(0);

            const content = await readMemoryFile(testStore, 'project/updatable');
            expect(content).toContain('Original content.');
            expect(content).toContain('new-tag');
        });
    });

    describe('prune command', () => {
        beforeEach(async () => {
            // Create some expired and non-expired memories
            await createMemoryFile(testStore, 'project/fresh-memory', {
                content: 'Fresh content.',
                expiresAt: new Date('2099-01-01T00:00:00.000Z'),
            });
            await createMemoryFile(testStore, 'project/expired-one', {
                content: 'Expired content.',
                expiresAt: new Date('2020-01-01T00:00:00.000Z'),
            });
            await createMemoryFile(testStore, 'project/expired-two', {
                content: 'Also expired.',
                expiresAt: new Date('2019-06-15T00:00:00.000Z'),
            });

            await createCategoryIndex(testStore, 'project', [
                { path: 'project/fresh-memory', tokenEstimate: 10 },
                { path: 'project/expired-one', tokenEstimate: 8 },
                { path: 'project/expired-two', tokenEstimate: 6 },
            ]);
        });

        it('should report expired memories with --dry-run', async () => {
            const result = await runCortexCli(['prune', '--dry-run'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Would prune');
            expect(result.stdout).toContain('project/expired-one');
            expect(result.stdout).toContain('project/expired-two');

            // Memories should still exist
            expect(await memoryExists(testStore, 'project/expired-one')).toBe(true);
            expect(await memoryExists(testStore, 'project/expired-two')).toBe(true);
        });

        it('should delete expired memories without --dry-run', async () => {
            const result = await runCortexCli(['prune'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Pruned');
            expect(result.stdout).toContain('2');

            // Expired memories should be deleted
            expect(await memoryExists(testStore, 'project/expired-one')).toBe(false);
            expect(await memoryExists(testStore, 'project/expired-two')).toBe(false);

            // Fresh memory should remain
            expect(await memoryExists(testStore, 'project/fresh-memory')).toBe(true);
        });

        it('should report when no expired memories found', async () => {
            // Remove expired memories first
            await fs.rm(join(testStore, 'memories', 'project', 'expired-one.md'));
            await fs.rm(join(testStore, 'memories', 'project', 'expired-two.md'));

            await createCategoryIndex(testStore, 'project', [
                { path: 'project/fresh-memory', tokenEstimate: 10 },
            ]);

            const result = await runCortexCli(['prune'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('No expired memories');
        });
    });

    describe('reindex command', () => {
        beforeEach(async () => {
            // Create memories without proper indexes
            await createMemoryFile(testStore, 'project/memory-a', {
                content: 'Memory A content.',
            });
            await createMemoryFile(testStore, 'project/memory-b', {
                content: 'Memory B content.',
            });
        });

        it('should rebuild indexes', async () => {
            const result = await runCortexCli(['reindex'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('Reindexed');

            // Verify index was created (indexes are stored as <category>.yml files)
            const indexPath = join(testStore, 'indexes', 'project.yml');
            const indexExists = await fs
                .access(indexPath)
                .then(() => true)
                .catch(() => false);
            expect(indexExists).toBe(true);
        });

        it('should fail with unexpected arguments', async () => {
            const result = await runCortexCli(['reindex', 'unexpected-arg'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('Unexpected arguments');
        });
    });

    describe('error handling', () => {
        it('should fail gracefully with unknown command', async () => {
            const result = await runCortexCli(['unknown-command'], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('Unknown command');
        });

        it('should fail gracefully when no command provided', async () => {
            const result = await runCortexCli([], {
                globalStorePath: testStore,
            });

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('No command provided');
        });

        it('should fail when --global-store has no value', async () => {
            const result = await runCortexCli(['--global-store'], {});

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain('--global-store requires a value');
        });

        it('should fail when store does not exist', async () => {
            const result = await runCortexCli(['list'], {
                globalStorePath: '/nonexistent/path/to/store',
            });

            expect(result.exitCode).toBe(1);
        });
    });

    describe('global store flag', () => {
        it('should use specified global store path', async () => {
            const secondStore = await createTestStore();
            await initializeTestStore(secondStore);

            // Add memory to second store
            await createMemoryFile(secondStore, 'project/second-store-memory', {
                content: 'Second store content.',
            });
            await createCategoryIndex(secondStore, 'project', [
                { path: 'project/second-store-memory', tokenEstimate: 10 },
            ]);

            const result = await runCortexCli(['list', 'project'], {
                globalStorePath: secondStore,
            });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('second-store-memory');

            await fs.rm(secondStore, { recursive: true, force: true });
        });
    });
});
