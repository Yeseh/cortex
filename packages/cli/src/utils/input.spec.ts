import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { resolveInput } from './input.ts';

const createMockStdin = (data: string, isTTY = false): NodeJS.ReadableStream => {
    const stream = Readable.from([data]) as NodeJS.ReadableStream & { isTTY?: boolean };
    stream.isTTY = isTTY;
    return stream;
};

describe('resolveMemoryContentInput', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(join(tmpdir(), 'cortex-input-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('content flag', () => {
        it('should return content from --content flag', async () => {
            const result = await resolveInput({
                content: 'Hello, world!',
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('Hello, world!');
                expect(result.value.source).toBe('flag');
            }
        });

        it('should return empty string when content is empty', async () => {
            const result = await resolveInput({
                content: '',
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('');
                expect(result.value.source).toBe('flag');
            }
        });
    });

    describe('file input', () => {
        it('should read content from file', async () => {
            const filePath = join(tempDir, 'input.txt');
            await fs.writeFile(filePath, 'File content here');

            const result = await resolveInput({
                filePath,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('File content here');
                expect(result.value.source).toBe('file');
            }
        });

        it('should return error for non-existent file', async () => {
            const result = await resolveInput({
                filePath: join(tempDir, 'nonexistent.txt'),
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('FILE_READ_FAILED');
                expect(result.error.path).toContain('nonexistent.txt');
            }
        });

        it('should return error for empty file path', async () => {
            const result = await resolveInput({
                filePath: '   ',
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_FILE_PATH');
            }
        });

        it('should trim file path before reading', async () => {
            const filePath = join(tempDir, 'trimmed.txt');
            await fs.writeFile(filePath, 'Trimmed content');

            const result = await resolveInput({
                filePath: `  ${filePath}  `,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('Trimmed content');
            }
        });
    });

    describe('stdin input', () => {
        it('should NOT treat an inherited stdin stream as provided unless explicitly requested', async () => {
            const mockStdin = createMockStdin('Should be ignored');

            const result = await resolveInput({
                stream: mockStdin,
                // stdinRequested intentionally omitted
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBeNull();
                expect(result.value.source).toBe('none');
            }
        });

        it('should read content from stdin', async () => {
            const mockStdin = createMockStdin('Stdin content');

            const result = await resolveInput({
                stream: mockStdin,
                stdinRequested: true,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('Stdin content');
                expect(result.value.source).toBe('stdin');
            }
        });

        it('should return null for TTY stdin', async () => {
            const mockStdin = createMockStdin('', true);

            const result = await resolveInput({
                stream: mockStdin,
                stdinRequested: true,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBeNull();
                expect(result.value.source).toBe('none');
            }
        });

        it('should read stdin when stdinRequested is true', async () => {
            const mockStdin = createMockStdin('Requested stdin');

            const result = await resolveInput({
                stream: mockStdin,
                stdinRequested: true,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('Requested stdin');
                expect(result.value.source).toBe('stdin');
            }
        });

        it('should skip stdin when stdinRequested is false', async () => {
            const mockStdin = createMockStdin('Ignored stdin');

            const result = await resolveInput({
                stream: mockStdin,
                stdinRequested: false,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBeNull();
                expect(result.value.source).toBe('none');
            }
        });
    });

    describe('multiple sources error', () => {
        it('should error when content and file are both provided', async () => {
            const result = await resolveInput({
                content: 'Content',
                filePath: '/some/file.txt',
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MULTIPLE_CONTENT_SOURCES');
            }
        });

        it('should error when content and stdin are both requested', async () => {
            const result = await resolveInput({
                content: 'Content',
                stream: createMockStdin('Stdin content'),
                stdinRequested: true,
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MULTIPLE_CONTENT_SOURCES');
            }
        });

        it('should error when file and stdin are both requested', async () => {
            const result = await resolveInput({
                filePath: '/some/file.txt',
                stream: createMockStdin('Stdin content'),
                stdinRequested: true,
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MULTIPLE_CONTENT_SOURCES');
            }
        });

        it('should error when all three sources are provided', async () => {
            const result = await resolveInput({
                content: 'Content',
                filePath: '/some/file.txt',
                stream: createMockStdin('Stdin content'),
                stdinRequested: true,
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MULTIPLE_CONTENT_SOURCES');
            }
        });
    });

    describe('missing content error', () => {
        it('should return null content when no source was provided', async () => {
            const result = await resolveInput({
                content: undefined,
                filePath: undefined,
                stream: undefined,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBeNull();
                expect(result.value.source).toBe('none');
            }
        });
    });

    describe('priority order', () => {
        it('should prefer content flag over file', async () => {
            // This should error because both are provided
            const result = await resolveInput({
                content: 'Flag content',
                filePath: join(tempDir, 'file.txt'),
            });

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('MULTIPLE_CONTENT_SOURCES');
            }
        });
    });

    describe('edge cases', () => {
        it('should handle multi-chunk stdin', async () => {
            const mockStdin = Readable.from([
                'chunk1',
                'chunk2',
                'chunk3',
            ]) as NodeJS.ReadableStream & { isTTY?: boolean };
            mockStdin.isTTY = false;

            const result = await resolveInput({
                stream: mockStdin,
                stdinRequested: true,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('chunk1chunk2chunk3');
            }
        });

        it('should handle stdin without setEncoding', async () => {
            // Create a minimal stream that doesn't have setEncoding
            const mockStdin = {
                isTTY: false,
                [Symbol.asyncIterator]: async function* () {
                    yield 'test data';
                },
            } as unknown as NodeJS.ReadableStream;

            const result = await resolveInput({
                stream: mockStdin,
                stdinRequested: true,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBe('test data');
            }
        });

        it('should handle empty options', async () => {
            const mockStdin = Readable.from([]) as NodeJS.ReadableStream & { isTTY?: boolean };
            mockStdin.isTTY = true;

            const result = await resolveInput({
                stream: mockStdin,
                stdinRequested: true,
            });

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.content).toBeNull();
                expect(result.value.source).toBe('none');
            }
        });
    });
});
