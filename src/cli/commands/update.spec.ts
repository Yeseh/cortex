import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runUpdateCommand } from './update.ts';

describe(
    'update CLI command', () => {
        let tempDir: string;

        const buildOptions = (
            args: string[],
            overrides?: { stdin?: NodeJS.ReadableStream; now?: Date },
        ) => ({
            storeRoot: tempDir,
            args,
            ...overrides,
        });

        const createMemoryFile = async (
            slugPath: string, content: string,
        ) => {
            const memoryDir = join(
                tempDir, 'memories', ...slugPath.split('/').slice(
                    0, -1,
                ),
            );
            await mkdir(
                memoryDir, { recursive: true },
            );
            const filePath = join(
                tempDir, 'memories', `${slugPath}.md`,
            );
            await writeFile(
                filePath, content, 'utf8',
            );
        };

        const readMemoryFile = async (slugPath: string): Promise<string> => {
            const filePath = join(
                tempDir, 'memories', `${slugPath}.md`,
            );
            return readFile(
                filePath, 'utf8',
            );
        };

        const createInputFile = async (content: string): Promise<string> => {
            const filePath = join(
                tempDir, 'input.txt',
            );
            await writeFile(
                filePath, content, 'utf8',
            );
            return filePath;
        };

        const buildMemoryContent = (opts: {
            createdAt?: string;
            updatedAt?: string;
            tags?: string[];
            source?: string;
            expiresAt?: string;
            content?: string;
        }) => {
            const lines = ['---'];
            lines.push(`created_at: ${opts.createdAt ?? '2024-01-01T00:00:00.000Z'}`);
            lines.push(`updated_at: ${opts.updatedAt ?? '2024-01-01T00:00:00.000Z'}`);
            lines.push(`tags: [${(opts.tags ?? []).join(', ')}]`);
            lines.push(`source: ${opts.source ?? 'user'}`);
            if (opts.expiresAt) {
                lines.push(`expires_at: ${opts.expiresAt}`); 
            }
            lines.push('---');
            lines.push(opts.content ?? 'Original content.');
            return lines.join('\n');
        };

        beforeEach(async () => {
            tempDir = await mkdtemp(join(
                tmpdir(), 'cortex-update-cli-',
            )); 
        });

        afterEach(async () => {
            if (tempDir) {
                await rm(
                    tempDir, { recursive: true, force: true },
                ); 
            } 
        });

        describe(
            'success cases', () => {
                it(
                    'should update memory content with --content flag', async () => {
                        const slugPath = 'project/test-memory';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--content',
                                'Updated content!',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        expect(result.value.message).toContain('Updated memory');
                        expect(result.value.message).toContain(slugPath);

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('Updated content!');
                        expect(content).toContain('updated_at: 2024-06-15T12:00:00.000Z');
                        // Original created_at should be preserved
                        expect(content).toContain('created_at: 2024-01-01T00:00:00.000Z');
                    },
                );

                it(
                    'should update memory content with --file flag', async () => {
                        const slugPath = 'project/file-memory';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const inputPath = await createInputFile('Content from file.');
                        const now = new Date('2024-06-15T12:00:00.000Z');

                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--file',
                                inputPath,
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('Content from file.');
                    },
                );

                it(
                    'should update memory tags with --tags flag', async () => {
                        const slugPath = 'project/tagged-memory';
                        await createMemoryFile(
                            slugPath,
                            buildMemoryContent({ tags: ['old-tag'], content: 'Keep this content' }),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--tags',
                                'new-tag,another-tag',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('new-tag');
                        expect(content).toContain('another-tag');
                        expect(content).not.toContain('old-tag');
                        // Content should be preserved
                        expect(content).toContain('Keep this content');
                    },
                );

                it(
                    'should update memory expiry with --expires-at flag', async () => {
                        const slugPath = 'project/expiring-memory';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--expires-at',
                                '2025-12-31T23:59:59.000Z',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('expires_at: 2025-12-31T23:59:59.000Z');
                    },
                );

                it(
                    'should clear memory expiry with --clear-expiry flag', async () => {
                        const slugPath = 'project/clear-expiry-memory';
                        await createMemoryFile(
                            slugPath,
                            buildMemoryContent({ expiresAt: '2024-12-31T23:59:59.000Z' }),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--clear-expiry', 
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).not.toContain('expires_at');
                    },
                );

                it(
                    'should update multiple fields at once', async () => {
                        const slugPath = 'project/multi-update';
                        await createMemoryFile(
                            slugPath,
                            buildMemoryContent({ tags: ['old'], content: 'Old content' }),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--content',
                                'New content',
                                '--tags',
                                'new-tag',
                                '--expires-at',
                                '2025-01-01T00:00:00.000Z',
                            ],
                            { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('New content');
                        expect(content).toContain('new-tag');
                        expect(content).not.toContain('old');
                        expect(content).toContain('expires_at: 2025-01-01T00:00:00.000Z');
                    },
                );

                it(
                    'should preserve fields not being updated', async () => {
                        const slugPath = 'project/preserve-fields';
                        await createMemoryFile(
                            slugPath,
                            buildMemoryContent({
                                tags: ['preserved-tag'],
                                expiresAt: '2025-01-01T00:00:00.000Z',
                                content: 'Preserved content',
                            }),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--tags',
                                'updated-tag',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('updated-tag');
                        expect(content).toContain('Preserved content');
                        expect(content).toContain('expires_at: 2025-01-01T00:00:00.000Z');
                    },
                );

                it(
                    'should handle deeply nested category paths', async () => {
                        const slugPath = 'a/b/c/d/deep-memory';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--content',
                                'Updated deep content',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('Updated deep content');
                    },
                );

                it(
                    'should replace tags with empty array when empty string provided', async () => {
                        const slugPath = 'project/clear-tags';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({ tags: [
                                'tag1',
                                'tag2', 
                            ] }),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--tags',
                                '',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('tags: []');
                    },
                );
            },
        );

        describe(
            'error cases', () => {
                it(
                    'should return INVALID_ARGS when memory path is missing', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            '--content',
                            'Hello', 
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('required');
                    },
                );

                it(
                    'should return INVALID_ARGS when no updates are provided', async () => {
                        const slugPath = 'project/no-updates';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const result = await runUpdateCommand(buildOptions([slugPath]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('No updates provided');
                    },
                );

                it(
                    'should return INVALID_ARGS for unknown flag', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'project/memory',
                            '--unknown',
                            'value',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('Unknown option');
                    },
                );

                it(
                    'should return INVALID_ARGS when --content flag has no value', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'project/memory',
                            '--content', 
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('--content');
                        expect(result.error.message).toContain('requires a value');
                    },
                );

                it(
                    'should return INVALID_ARGS when --file flag has no value', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'project/memory',
                            '--file', 
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('--file');
                        expect(result.error.message).toContain('requires a value');
                    },
                );

                it(
                    'should return INVALID_ARGS when --tags flag has no value', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'project/memory',
                            '--tags', 
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('--tags');
                        expect(result.error.message).toContain('requires a value');
                    },
                );

                it(
                    'should return INVALID_ARGS when --expires-at flag has no value', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'project/memory',
                            '--expires-at', 
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('--expires-at');
                        expect(result.error.message).toContain('requires a value');
                    },
                );

                it(
                    'should return INVALID_ARGS for invalid expires-at timestamp', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'project/memory',
                            '--expires-at',
                            'not-a-date',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('valid ISO timestamp');
                    },
                );

                it(
                    'should return INVALID_ARGS when both --expires-at and --clear-expiry are provided', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'project/memory',
                            '--expires-at',
                            '2025-01-01T00:00:00.000Z',
                            '--clear-expiry',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('--expires-at');
                        expect(result.error.message).toContain('--clear-expiry');
                    },
                );

                it(
                    'should return INVALID_ARGS for tags with empty parts', async () => {
                        const slugPath = 'project/memory';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const result = await runUpdateCommand(buildOptions([
                            slugPath,
                            '--tags',
                            'foo,,bar',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('non-empty');
                    },
                );

                it(
                    'should return INVALID_ARGS for too many positional arguments', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'project/memory',
                            'extra-arg',
                            '--content',
                            'Hello',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGS');
                        expect(result.error.message).toContain('Only one memory path');
                    },
                );

                it(
                    'should return INVALID_PATH for invalid slug path (missing category)', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'single-segment',
                            '--content',
                            'Hello',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_PATH');
                        expect(result.error.message).toContain('at least two segments');
                    },
                );

                it(
                    'should return INVALID_PATH for invalid slug characters', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'Project/Invalid_Memory',
                            '--content',
                            'Hello',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_PATH');
                        expect(result.error.message).toContain('lowercase');
                    },
                );

                it(
                    'should return MEMORY_NOT_FOUND when memory does not exist', async () => {
                        const result = await runUpdateCommand(buildOptions([
                            'project/nonexistent',
                            '--content',
                            'Hello',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('MEMORY_NOT_FOUND');
                        expect(result.error.message).toContain('not found');
                    },
                );

                it(
                    'should return CONTENT_INPUT_FAILED when file does not exist', async () => {
                        const slugPath = 'project/memory';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const result = await runUpdateCommand(buildOptions([
                            slugPath,
                            '--file',
                            '/nonexistent/file.txt',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('CONTENT_INPUT_FAILED');
                    },
                );

                it(
                    'should return PARSE_FAILED for malformed memory file', async () => {
                        const slugPath = 'project/malformed';
                        await createMemoryFile(
                            slugPath, 'This file has no frontmatter.',
                        );

                        const result = await runUpdateCommand(buildOptions([
                            slugPath,
                            '--content',
                            'New content',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('PARSE_FAILED');
                    },
                );
            },
        );

        describe(
            'edge cases', () => {
                it(
                    'should ignore empty string arguments', async () => {
                        const slugPath = 'project/memory';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                '',
                                slugPath,
                                '',
                                '--content',
                                'Hello',
                                '',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('Hello');
                    },
                );

                it(
                    'should handle content with special characters', async () => {
                        const slugPath = 'project/special';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const specialContent = 'Code: `const x = 1;`\nYAML: key: value';

                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--content',
                                specialContent,
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('Code: `const x = 1;`');
                    },
                );

                it(
                    'should handle very long content', async () => {
                        const slugPath = 'project/long-content';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const longContent = 'x'.repeat(10000);
                        const inputPath = await createInputFile(longContent);
                        const now = new Date('2024-06-15T12:00:00.000Z');

                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--file',
                                inputPath,
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain(longContent);
                    },
                );

                it(
                    'should trim tag values', async () => {
                        const slugPath = 'project/trimmed-tags';
                        await createMemoryFile(
                            slugPath, buildMemoryContent({}),
                        );

                        const now = new Date('2024-06-15T12:00:00.000Z');
                        const result = await runUpdateCommand(buildOptions(
                            [
                                slugPath,
                                '--tags',
                                ' foo , bar ',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile(slugPath);
                        expect(content).toContain('foo');
                        expect(content).toContain('bar');
                    },
                );
            },
        );
    },
);
