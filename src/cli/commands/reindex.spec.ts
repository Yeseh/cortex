import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runReindexCommand } from './reindex.ts';

describe('reindex CLI command', () => {
    let tempDir: string;

    const buildOptions = (args: string[]) => ({
        storeRoot: tempDir,
        args,
    });

    const createMemoryFile = async (slugPath: string, content: string) => {
        const memoryDir = join(tempDir, ...slugPath.split('/').slice(0, -1));
        await mkdir(memoryDir, { recursive: true });
        const filePath = join(tempDir, `${slugPath}.md`);
        await writeFile(filePath, content, 'utf8');
    };

    const readIndexFile = async (categoryPath: string): Promise<string | null> => {
        const indexPath = join(tempDir, categoryPath, 'index.yaml');
        try {
            return await readFile(indexPath, 'utf8');
        }
        catch {
            return null;
        }
    };

    const indexExists = async (categoryPath: string): Promise<boolean> => {
        const content = await readIndexFile(categoryPath);
        return content !== null;
    };

    const buildMemoryContent = (opts: {
        createdAt?: string;
        updatedAt?: string;
        tags?: string[];
        source?: string;
        content?: string;
    }) => {
        const lines = ['---'];
        lines.push(`created_at: ${opts.createdAt ?? '2024-01-01T00:00:00.000Z'}`);
        lines.push(`updated_at: ${opts.updatedAt ?? '2024-01-01T00:00:00.000Z'}`);
        lines.push(`tags: [${(opts.tags ?? []).join(', ')}]`);
        lines.push(`source: ${opts.source ?? 'user'}`);
        lines.push('---');
        lines.push(opts.content ?? 'Memory content.');
        return lines.join('\n');
    };

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-reindex-cli-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('success cases', () => {
        it('should reindex category indexes for single memory', async () => {
            await createMemoryFile('project/test-memory', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.message).toContain('Reindexed');
            expect(result.value.message).toContain(tempDir);

            const indexExists_ = await indexExists('project');
            expect(indexExists_).toBe(true);

            const indexContent = await readIndexFile('project');
            expect(indexContent).toContain('test-memory');
        });

        it('should reindex category indexes for multiple memories in same category', async () => {
            await createMemoryFile('project/memory-a', buildMemoryContent({}));
            await createMemoryFile('project/memory-b', buildMemoryContent({}));
            await createMemoryFile('project/memory-c', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const indexContent = await readIndexFile('project');
            expect(indexContent).toContain('memory-a');
            expect(indexContent).toContain('memory-b');
            expect(indexContent).toContain('memory-c');
        });

        it('should reindex category indexes for memories in multiple categories', async () => {
            await createMemoryFile('project-a/memory-1', buildMemoryContent({}));
            await createMemoryFile('project-b/memory-2', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(await indexExists('project-a')).toBe(true);
            expect(await indexExists('project-b')).toBe(true);

            const indexA = await readIndexFile('project-a');
            const indexB = await readIndexFile('project-b');
            expect(indexA).toContain('memory-1');
            expect(indexB).toContain('memory-2');
        });

        it('should reindex deeply nested categories', async () => {
            await createMemoryFile('a/b/c/deep-memory', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            // Check for index at each level
            expect(await indexExists('a')).toBe(true);
            expect(await indexExists('a/b')).toBe(true);
            expect(await indexExists('a/b/c')).toBe(true);

            const deepIndex = await readIndexFile('a/b/c');
            expect(deepIndex).toContain('deep-memory');
        });

        it('should track subcategories in parent indexes', async () => {
            await createMemoryFile('parent/child/memory', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const parentIndex = await readIndexFile('parent');
            // Parent index should reference subcategory
            expect(parentIndex).toContain('child');
        });

        it('should handle empty store gracefully', async () => {
            // No memories created
            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.message).toContain('Reindexed');
        });

        it('should include memory metadata in index', async () => {
            await createMemoryFile(
                'project/tagged-memory',
                buildMemoryContent({
                    tags: [
                        'important', 'work',
                    ],
                    createdAt: '2024-03-15T10:00:00.000Z',
                    updatedAt: '2024-03-16T14:30:00.000Z',
                }),
            );

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const indexContent = await readIndexFile('project');
            expect(indexContent).toContain('tagged-memory');
            expect(indexContent).toContain('token_estimate');
        });

        it('should replace existing indexes completely', async () => {
            // First create a memory and index it
            await createMemoryFile('project/first-memory', buildMemoryContent({}));
            await runReindexCommand(buildOptions([]));

            let indexContent = await readIndexFile('project');
            expect(indexContent).toContain('first-memory');

            // Now remove that memory file manually (simulating external deletion)
            await rm(join(tempDir, 'project', 'first-memory.md'));

            // Add a different memory
            await createMemoryFile('project/second-memory', buildMemoryContent({}));

            // Reindex
            const result = await runReindexCommand(buildOptions([]));
            expect(result.ok).toBe(true);

            // First memory should be gone, second should be present
            indexContent = await readIndexFile('project');
            expect(indexContent).not.toContain('first-memory');
            expect(indexContent).toContain('second-memory');
        });
    });

    describe('error cases', () => {
        it('should return INVALID_ARGUMENTS when extra arguments are provided', async () => {
            const result = await runReindexCommand(buildOptions(['extra-arg']));

            expect(result.ok).toBe(false);
            if (result.ok) return;

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Unexpected arguments');
            expect(result.error.message).toContain('extra-arg');
        });

        it('should return INVALID_ARGUMENTS for multiple extra arguments', async () => {
            const result = await runReindexCommand(buildOptions([
                'arg1',
                'arg2',
                'arg3',
            ]));

            expect(result.ok).toBe(false);
            if (result.ok) return;

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.details?.args).toEqual([
                'arg1',
                'arg2',
                'arg3',
            ]);
        });

        it('should return INVALID_ARGUMENTS for unknown flag arguments', async () => {
            const result = await runReindexCommand(buildOptions(['--unknown-flag']));

            expect(result.ok).toBe(false);
            if (result.ok) return;

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('--unknown-flag');
        });
    });

    describe('edge cases', () => {
        it('should handle memory with special content characters', async () => {
            await createMemoryFile(
                'project/special',
                buildMemoryContent({
                    content: 'YAML: key: value\n---\nMore content',
                }),
            );

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const indexContent = await readIndexFile('project');
            expect(indexContent).toContain('special');
        });

        it('should handle many memories efficiently', async () => {
            // Create 50 memories across multiple categories
            for (let i = 0; i < 50; i++) {
                const category = `category-${i % 5}`;
                await createMemoryFile(
                    `${category}/memory-${i}`,
                    buildMemoryContent({ tags: [`tag-${i}`] }),
                );
            }

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            // Verify all 5 categories have indexes
            for (let i = 0; i < 5; i++) {
                expect(await indexExists(`category-${i}`)).toBe(true);
            }
        });

        it('should handle slug paths with hyphens', async () => {
            await createMemoryFile('my-project/sub-category/my-memory', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(await indexExists('my-project')).toBe(true);
            expect(await indexExists('my-project/sub-category')).toBe(true);

            const indexContent = await readIndexFile('my-project/sub-category');
            expect(indexContent).toContain('my-memory');
        });
    });

    describe('slug normalization', () => {
        // Helper to create memory file at a specific raw path
        const createMemoryFileRaw = async (rawPath: string, content: string) => {
            const memoryDir = join(tempDir, ...rawPath.split('/').slice(0, -1));
            await mkdir(memoryDir, { recursive: true });
            const filePath = join(tempDir, rawPath);
            await writeFile(filePath, content, 'utf8');
        };

        it('should normalize uppercase paths', async () => {
            await createMemoryFileRaw('Project/MyMemory.md', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const indexContent = await readIndexFile('project');
            expect(indexContent).toContain('project/mymemory');
        });

        it('should normalize underscore paths', async () => {
            await createMemoryFileRaw('my_project/some_memory.md', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const indexContent = await readIndexFile('my-project');
            expect(indexContent).toContain('my-project/some-memory');
        });

        it('should normalize mixed invalid characters', async () => {
            await createMemoryFileRaw('My Project/Some_Memory.md', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            const indexContent = await readIndexFile('my-project');
            expect(indexContent).toContain('my-project/some-memory');
        });

        it('should handle collisions with numeric suffix', async () => {
            // Create two files that normalize to the same slug
            await createMemoryFileRaw('project/my_memory.md', buildMemoryContent({ content: 'First file' }));
            await createMemoryFileRaw('project/my-memory.md', buildMemoryContent({ content: 'Second file' }));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            // One should have suffix -2
            expect(result.value.warnings.length).toBe(1);
            expect(result.value.warnings[0]).toContain('Collision');
            expect(result.value.warnings[0]).toContain('my-memory-2');
        });

        it('should skip paths that normalize to empty with warning', async () => {
            // A path with only special characters
            await createMemoryFileRaw('project/@#$.md', buildMemoryContent({}));
            // A valid path too
            await createMemoryFileRaw('project/valid-memory.md', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            // Should have warning about skipped file
            expect(result.value.warnings.length).toBe(1);
            expect(result.value.warnings[0]).toContain('Skipped');
            expect(result.value.warnings[0]).toContain('normalizes to empty');

            // Valid memory should still be indexed
            const indexContent = await readIndexFile('project');
            expect(indexContent).toContain('valid-memory');
        });

        it('should show warning count in message', async () => {
            await createMemoryFileRaw('project/my_memory.md', buildMemoryContent({}));
            await createMemoryFileRaw('project/my-memory.md', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.message).toContain('1 warning');
        });

        it('should show warning details with --verbose flag', async () => {
            await createMemoryFileRaw('project/my_memory.md', buildMemoryContent({}));
            await createMemoryFileRaw('project/my-memory.md', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions(['--verbose']));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.message).toContain('Warnings:');
            expect(result.value.message).toContain('Collision');
        });

        it('should not show warning details without --verbose flag', async () => {
            await createMemoryFileRaw('project/my_memory.md', buildMemoryContent({}));
            await createMemoryFileRaw('project/my-memory.md', buildMemoryContent({}));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            expect(result.value.message).not.toContain('Warnings:');
        });

        it('should handle multiple collisions correctly', async () => {
            // Use different filenames that all normalize to 'test-file' 
            // (avoiding case variations due to Windows case-insensitivity)
            await createMemoryFileRaw('project/test_file.md', buildMemoryContent({ content: 'File 1' }));
            await createMemoryFileRaw('project/test-file.md', buildMemoryContent({ content: 'File 2' }));
            await createMemoryFileRaw('project/test__file.md', buildMemoryContent({ content: 'File 3' }));

            const result = await runReindexCommand(buildOptions([]));

            expect(result.ok).toBe(true);
            if (!result.ok) return;

            // Should have 2 collision warnings (for -2 and -3)
            expect(result.value.warnings.length).toBe(2);
            expect(result.value.message).toContain('2 warnings');

            // Verify the index has all three entries
            const indexContent = await readIndexFile('project');
            expect(indexContent).toContain('test-file');
            expect(indexContent).toContain('test-file-2');
            expect(indexContent).toContain('test-file-3');
        });
    });
});
