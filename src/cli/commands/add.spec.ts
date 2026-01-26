import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { Readable } from 'node:stream';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runAddCommand } from './add.ts';

/**
 * Create a mock TTY stdin stream that signals no piped input available.
 */
const createTtyStdin = (): NodeJS.ReadableStream => {
    const stream = new Readable({ read() {} }) as unknown as NodeJS.ReadableStream & {
        isTTY: boolean;
    };
    stream.isTTY = true;
    return stream;
};

describe(
    'add CLI command', () => {
        let tempDir: string;

        const buildOptions = (
            args: string[],
            overrides?: { stdin?: NodeJS.ReadableStream; now?: Date },
        ) => ({
            storeRoot: tempDir,
            args,
            ...overrides,
        });

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

        beforeEach(async () => {
            tempDir = await mkdtemp(join(
                tmpdir(), 'cortex-add-cli-',
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
                    'should add memory with --content flag', async () => {
                        const now = new Date('2024-01-15T10:00:00.000Z');
                        const result = await runAddCommand(buildOptions(
                            [
                                'project/test-memory',
                                '--content',
                                'Hello, world!',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        expect(result.value.message).toContain('Added memory');
                        expect(result.value.message).toContain('project/test-memory');
                        expect(result.value.message).toContain('flag');

                        const content = await readMemoryFile('project/test-memory');
                        expect(content).toContain('Hello, world!');
                        expect(content).toContain('created_at: 2024-01-15T10:00:00.000Z');
                        expect(content).toContain('updated_at: 2024-01-15T10:00:00.000Z');
                        expect(content).toContain('source: flag');
                    },
                );

                it(
                    'should add memory with --file flag', async () => {
                        const inputPath = await createInputFile('Content from file.');
                        const now = new Date('2024-02-20T14:30:00.000Z');

                        const result = await runAddCommand(buildOptions(
                            [
                                'project/file-memory',
                                '--file',
                                inputPath,
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        expect(result.value.message).toContain('Added memory');
                        expect(result.value.message).toContain('file');

                        const content = await readMemoryFile('project/file-memory');
                        expect(content).toContain('Content from file.');
                        expect(content).toContain('source: file');
                    },
                );

                it(
                    'should add memory with --tags flag', async () => {
                        const now = new Date('2024-03-01T00:00:00.000Z');
                        const result = await runAddCommand(buildOptions(
                            [
                                'project/tagged-memory',
                                '--content',
                                'Tagged content',
                                '--tags',
                                'foo,bar,baz',
                            ],
                            { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('project/tagged-memory');
                        expect(content).toContain('tags:');
                        expect(content).toContain('foo');
                        expect(content).toContain('bar');
                        expect(content).toContain('baz');
                    },
                );

                it(
                    'should add memory with --expires-at flag', async () => {
                        const now = new Date('2024-01-01T00:00:00.000Z');
                        const result = await runAddCommand(buildOptions(
                            [
                                'project/expiring-memory',
                                '--content',
                                'Expires soon',
                                '--expires-at',
                                '2024-12-31T23:59:59.000Z',
                            ],
                            { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('project/expiring-memory');
                        expect(content).toContain('expires_at: 2024-12-31T23:59:59.000Z');
                    },
                );

                it(
                    'should add memory with all flags combined', async () => {
                        const inputPath = await createInputFile('Full featured content.');
                        const now = new Date('2024-06-15T12:00:00.000Z');

                        const result = await runAddCommand(buildOptions(
                            [
                                'category/subcategory/full-memory',
                                '--file',
                                inputPath,
                                '--tags',
                                'important,work',
                                '--expires-at',
                                '2025-01-01T00:00:00.000Z',
                            ],
                            { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('category/subcategory/full-memory');
                        expect(content).toContain('Full featured content.');
                        expect(content).toContain('source: file');
                        expect(content).toContain('important');
                        expect(content).toContain('work');
                        expect(content).toContain('expires_at: 2025-01-01T00:00:00.000Z');
                    },
                );

                it(
                    'should handle deeply nested category paths', async () => {
                        const now = new Date('2024-01-01T00:00:00.000Z');
                        const result = await runAddCommand(buildOptions(
                            [
                                'a/b/c/d/deep-memory',
                                '--content',
                                'Deep content',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('a/b/c/d/deep-memory');
                        expect(content).toContain('Deep content');
                    },
                );

                it(
                    'should handle empty tags list', async () => {
                        const now = new Date('2024-01-01T00:00:00.000Z');
                        const result = await runAddCommand(buildOptions(
                            [
                                'project/no-tags',
                                '--content',
                                'No tags',
                                '--tags',
                                '',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('project/no-tags');
                        expect(content).toContain('tags: []');
                    },
                );

                it(
                    'should handle multiline content', async () => {
                        const inputPath = await createInputFile('Line 1\nLine 2\n\nParagraph 2.');
                        const now = new Date('2024-01-01T00:00:00.000Z');

                        const result = await runAddCommand(buildOptions(
                            [
                                'project/multiline',
                                '--file',
                                inputPath,
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('project/multiline');
                        expect(content).toContain('Line 1');
                        expect(content).toContain('Line 2');
                        expect(content).toContain('Paragraph 2.');
                    },
                );

                it(
                    'should trim tag values', async () => {
                        const now = new Date('2024-01-01T00:00:00.000Z');
                        const result = await runAddCommand(buildOptions(
                            [
                                'project/trimmed-tags',
                                '--content',
                                'Content',
                                '--tags',
                                ' foo , bar ',
                            ],
                            { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('project/trimmed-tags');
                        expect(content).toContain('foo');
                        expect(content).toContain('bar');
                    },
                );
            },
        );

        describe(
            'error cases', () => {
                it(
                    'should return INVALID_ARGUMENTS when memory path is missing', async () => {
                        const result = await runAddCommand(buildOptions([
                            '--content',
                            'Hello', 
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGUMENTS');
                        expect(result.error.message).toContain('required');
                    },
                );

                it(
                    'should return INVALID_ARGUMENTS for unknown flag', async () => {
                        const result = await runAddCommand(buildOptions([
                            'project/memory',
                            '--unknown',
                            'value',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGUMENTS');
                        expect(result.error.message).toContain('Unknown flag');
                        expect(result.error.message).toContain('--unknown');
                    },
                );

                it(
                    'should return INVALID_ARGUMENTS when --content flag has no value', async () => {
                        const result = await runAddCommand(buildOptions([
                            'project/memory',
                            '--content', 
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGUMENTS');
                        expect(result.error.message).toContain('--content');
                        expect(result.error.message).toContain('requires a value');
                    },
                );

                it(
                    'should return INVALID_ARGUMENTS when --file flag has no value', async () => {
                        const result = await runAddCommand(buildOptions([
                            'project/memory',
                            '--file', 
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGUMENTS');
                        expect(result.error.message).toContain('--file');
                        expect(result.error.message).toContain('requires a value');
                    },
                );

                it(
                    'should return INVALID_ARGUMENTS when --tags flag has no value', async () => {
                        const result = await runAddCommand(buildOptions([
                            'project/memory',
                            '--content',
                            'Hello',
                            '--tags',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGUMENTS');
                        expect(result.error.message).toContain('--tags');
                        expect(result.error.message).toContain('requires a value');
                    },
                );

                it(
                    'should return INVALID_ARGUMENTS when --expires-at flag has no value', async () => {
                        const result = await runAddCommand(buildOptions([
                            'project/memory',
                            '--content',
                            'Hello',
                            '--expires-at',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGUMENTS');
                        expect(result.error.message).toContain('--expires-at');
                        expect(result.error.message).toContain('requires a value');
                    },
                );

                it(
                    'should return INVALID_ARGUMENTS for invalid expires-at timestamp', async () => {
                        const result = await runAddCommand(buildOptions([
                            'project/memory',
                            '--content',
                            'Hello',
                            '--expires-at',
                            'not-a-date',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGUMENTS');
                        expect(result.error.message).toContain('valid ISO timestamp');
                    },
                );

                it(
                    'should return INVALID_ARGUMENTS for tags with empty parts', async () => {
                        const result = await runAddCommand(buildOptions([
                            'project/memory',
                            '--content',
                            'Hello',
                            '--tags',
                            'foo,,bar',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGUMENTS');
                        expect(result.error.message).toContain('non-empty');
                    },
                );

                it(
                    'should return INVALID_ARGUMENTS for too many positional arguments', async () => {
                        const result = await runAddCommand(buildOptions([
                            'project/memory',
                            'extra-arg',
                            '--content',
                            'Hello',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('INVALID_ARGUMENTS');
                        expect(result.error.message).toContain('Too many positional arguments');
                    },
                );

                it(
                    'should return INVALID_PATH for invalid slug path (missing category)', async () => {
                        const result = await runAddCommand(buildOptions([
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
                        const result = await runAddCommand(buildOptions([
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
                    'should return CONTENT_INPUT_FAILED when no content source is provided', async () => {
                        const result = await runAddCommand(buildOptions(
                            ['project/memory'], { stdin: createTtyStdin() },
                        ));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('CONTENT_INPUT_FAILED');
                    },
                );

                it(
                    'should return CONTENT_INPUT_FAILED when file does not exist', async () => {
                        const result = await runAddCommand(buildOptions([
                            'project/memory',
                            '--file',
                            '/nonexistent/file.txt',
                        ]));

                        expect(result.ok).toBe(false);
                        if (result.ok) return;

                        expect(result.error.code).toBe('CONTENT_INPUT_FAILED');
                    },
                );
            },
        );

        describe(
            'edge cases', () => {
                it(
                    'should ignore empty string arguments', async () => {
                        const now = new Date('2024-01-01T00:00:00.000Z');
                        const result = await runAddCommand(buildOptions(
                            [
                                '',
                                'project/memory',
                                '',
                                '--content',
                                'Hello',
                                '',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('project/memory');
                        expect(content).toContain('Hello');
                    },
                );

                it(
                    'should handle content with special characters', async () => {
                        const now = new Date('2024-01-01T00:00:00.000Z');
                        const specialContent = 'Code: `const x = 1;`\nYAML: key: value\n---\nMore content';

                        const result = await runAddCommand(buildOptions(
                            [
                                'project/special',
                                '--content',
                                specialContent,
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('project/special');
                        expect(content).toContain('Code: `const x = 1;`');
                    },
                );

                it(
                    'should handle very long content', async () => {
                        const longContent = 'x'.repeat(10000);
                        const inputPath = await createInputFile(longContent);
                        const now = new Date('2024-01-01T00:00:00.000Z');

                        const result = await runAddCommand(buildOptions(
                            [
                                'project/long-content',
                                '--file',
                                inputPath,
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('project/long-content');
                        expect(content).toContain(longContent);
                    },
                );

                it(
                    'should handle slug path with normalized segments', async () => {
                        // Double slashes are normalized
                        const now = new Date('2024-01-01T00:00:00.000Z');
                        const result = await runAddCommand(buildOptions(
                            [
                                'project//memory',
                                '--content',
                                'Hello',
                            ], { now },
                        ));

                        expect(result.ok).toBe(true);
                        if (!result.ok) return;

                        const content = await readMemoryFile('project/memory');
                        expect(content).toContain('Hello');
                    },
                );
            },
        );
    },
);
