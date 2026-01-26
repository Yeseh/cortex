import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runShowCommand } from './show.ts';

describe('show CLI command', () => {
    let tempDir: string;

    const buildOptions = (args: string[]) => ({
        storeRoot: tempDir,
        args,
    });

    const createMemoryFile = async (storeRoot: string, slugPath: string, content: string) => {
        const memoryDir = join(storeRoot, 'memories', ...slugPath.split('/').slice(0, -1));
        await mkdir(memoryDir, { recursive: true });
        const filePath = join(storeRoot, 'memories', `${slugPath}.md`);
        await writeFile(filePath, content, 'utf8');
    };

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-show-cli-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('success cases', () => {
        it('should show existing memory with all frontmatter fields', async () => {
            const slugPath = 'project/test-memory';
            const memoryContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-02T00:00:00.000Z',
                'tags: [test, example]',
                'source: user',
                '---',
                'Memory content goes here.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            const memory = result.value.output.value;
            expect(memory.path).toBe(slugPath);
            expect(memory.metadata.createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
            expect(memory.metadata.updatedAt).toEqual(new Date('2024-01-02T00:00:00.000Z'));
            expect(memory.metadata.tags).toEqual(['test', 'example']);
            expect(memory.metadata.source).toBe('user');
            expect(memory.content).toBe('Memory content goes here.');
        });

        it('should show memory with optional expiresAt field', async () => {
            const slugPath = 'project/expiring-memory';
            const memoryContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-02T00:00:00.000Z',
                'tags: [test]',
                'source: system',
                'expires_at: 2024-12-31T23:59:59.000Z',
                '---',
                'This memory will expire.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            const memory = result.value.output.value;
            expect(memory.path).toBe(slugPath);
            expect(memory.metadata.expiresAt).toEqual(new Date('2024-12-31T23:59:59.000Z'));
            expect(memory.content).toBe('This memory will expire.');
        });

        it('should show memory without expiresAt field', async () => {
            const slugPath = 'project/permanent-memory';
            const memoryContent = [
                '---',
                'created_at: 2024-03-15T10:30:00.000Z',
                'updated_at: 2024-03-16T14:45:00.000Z',
                'tags: [permanent, important]',
                'source: agent',
                '---',
                'This memory has no expiration.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            const memory = result.value.output.value;
            expect(memory.path).toBe(slugPath);
            expect(memory.metadata.expiresAt).toBeUndefined();
            expect(memory.metadata.createdAt).toEqual(new Date('2024-03-15T10:30:00.000Z'));
            expect(memory.metadata.updatedAt).toEqual(new Date('2024-03-16T14:45:00.000Z'));
            expect(memory.metadata.tags).toEqual(['permanent', 'important']);
            expect(memory.metadata.source).toBe('agent');
            expect(memory.content).toBe('This memory has no expiration.');
        });

        it('should include token estimate in metadata', async () => {
            const slugPath = 'project/token-test';
            const memoryContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-01T00:00:00.000Z',
                'tags: []',
                'source: test',
                '---',
                'Some content for token estimation.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            const memory = result.value.output.value;
            expect(memory.metadata.tokenEstimate).toBeDefined();
            expect(typeof memory.metadata.tokenEstimate).toBe('number');
            expect(memory.metadata.tokenEstimate).toBeGreaterThan(0);
        });

        it('should handle deeply nested category paths', async () => {
            const slugPath = 'category/subcategory/deep/nested-memory';
            const memoryContent = [
                '---',
                'created_at: 2024-06-01T00:00:00.000Z',
                'updated_at: 2024-06-01T00:00:00.000Z',
                'tags: [deep, nested]',
                'source: test',
                '---',
                'Deeply nested memory content.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            expect(result.value.output.value.path).toBe(slugPath);
        });

        it('should handle multiline content', async () => {
            const slugPath = 'project/multiline-memory';
            const contentBody = 'Line 1\nLine 2\nLine 3\n\nParagraph 2.';
            const memoryContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-01T00:00:00.000Z',
                'tags: [multiline]',
                'source: test',
                '---',
                contentBody,
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            expect(result.value.output.value.content).toBe(contentBody);
        });

        it('should handle empty tags array', async () => {
            const slugPath = 'project/no-tags';
            const memoryContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-01T00:00:00.000Z',
                'tags: []',
                'source: test',
                '---',
                'No tags memory.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            expect(result.value.output.value.metadata.tags).toEqual([]);
        });
    });

    describe('error cases', () => {
        it('should return INVALID_ARGUMENTS when args are empty', async () => {
            const result = await runShowCommand(buildOptions([]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('required');
        });

        it('should return INVALID_ARGUMENTS for unknown flag', async () => {
            const result = await runShowCommand(buildOptions(['--unknown']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Unknown flag');
            expect(result.error.message).toContain('--unknown');
        });

        it('should return INVALID_ARGUMENTS for short unknown flag', async () => {
            const result = await runShowCommand(buildOptions(['-x']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Unknown flag');
        });

        it('should return INVALID_ARGUMENTS for too many positional arguments', async () => {
            const result = await runShowCommand(buildOptions(['project/memory', 'extra-arg']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Too many positional arguments');
        });

        it('should return INVALID_PATH for invalid slug path (missing category)', async () => {
            const result = await runShowCommand(buildOptions(['single-segment']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_PATH');
            expect(result.error.message).toContain('at least two segments');
        });

        it('should normalize empty path segments and return MEMORY_NOT_FOUND', async () => {
            // Empty segments are filtered out during normalization, so "project//memory"
            // becomes "project/memory" which is a valid path structure
            const result = await runShowCommand(buildOptions(['project//memory']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            // Since the path is valid after normalization but the memory doesn't exist
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
        });

        it('should return INVALID_PATH for invalid slug characters', async () => {
            const result = await runShowCommand(buildOptions(['Project/Invalid_Memory']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_PATH');
            expect(result.error.message).toContain('lowercase');
        });

        it('should return MEMORY_NOT_FOUND when memory does not exist', async () => {
            const result = await runShowCommand(buildOptions(['project/nonexistent-memory']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
            expect(result.error.message).toContain('not found');
            expect(result.error.message).toContain('project/nonexistent-memory');
        });

        it('should return PARSE_FAILED for malformed memory file (missing frontmatter)', async () => {
            const slugPath = 'project/malformed-memory';
            const malformedContent = 'This file has no frontmatter at all.';

            await createMemoryFile(tempDir, slugPath, malformedContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('PARSE_FAILED');
        });

        it('should return PARSE_FAILED for unclosed frontmatter', async () => {
            const slugPath = 'project/unclosed-frontmatter';
            const malformedContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-02T00:00:00.000Z',
                'tags: [test]',
                'source: user',
                'This frontmatter is never closed',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, malformedContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('PARSE_FAILED');
        });

        it('should return PARSE_FAILED for missing required field (created_at)', async () => {
            const slugPath = 'project/missing-created';
            const malformedContent = [
                '---',
                'updated_at: 2024-01-02T00:00:00.000Z',
                'tags: [test]',
                'source: user',
                '---',
                'Missing created_at field.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, malformedContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('PARSE_FAILED');
        });

        it('should return PARSE_FAILED for missing required field (source)', async () => {
            const slugPath = 'project/missing-source';
            const malformedContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-02T00:00:00.000Z',
                'tags: [test]',
                '---',
                'Missing source field.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, malformedContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('PARSE_FAILED');
        });

        it('should return PARSE_FAILED for invalid timestamp format', async () => {
            const slugPath = 'project/invalid-timestamp';
            const malformedContent = [
                '---',
                'created_at: not-a-valid-date',
                'updated_at: 2024-01-02T00:00:00.000Z',
                'tags: [test]',
                'source: user',
                '---',
                'Invalid timestamp.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, malformedContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('PARSE_FAILED');
        });

        it('should return PARSE_FAILED for invalid tags format', async () => {
            const slugPath = 'project/invalid-tags';
            const malformedContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-02T00:00:00.000Z',
                'tags: not-an-array',
                'source: user',
                '---',
                'Invalid tags format.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, malformedContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('PARSE_FAILED');
        });
    });

    describe('edge cases', () => {
        it('should handle empty content body', async () => {
            const slugPath = 'project/empty-content';
            const memoryContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-01T00:00:00.000Z',
                'tags: []',
                'source: test',
                '---',
                '',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            expect(result.value.output.value.content).toBe('');
        });

        it('should return INVALID_PATH for whitespace-only slug path argument', async () => {
            // Whitespace-only argument becomes empty string after trim, then filtered out
            // Result is no slug path provided
            const result = await runShowCommand(buildOptions(['   ']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            // Whitespace-only is treated as empty and results in INVALID_PATH
            // because normalizeSlugSegments filters it out, leaving fewer than 2 segments
            expect(result.error.code).toBe('INVALID_PATH');
        });

        it('should ignore empty string arguments', async () => {
            const slugPath = 'project/test-memory';
            const memoryContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-01T00:00:00.000Z',
                'tags: []',
                'source: test',
                '---',
                'Content.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions(['', slugPath, '']));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            expect(result.value.output.value.path).toBe(slugPath);
        });

        it('should normalize trailing slashes and return MEMORY_NOT_FOUND', async () => {
            // Trailing slash creates an empty segment which is filtered out during normalization
            // So "project/memory/" becomes ["project", "memory"] which is valid
            const result = await runShowCommand(buildOptions(['project/memory/']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            // Path is valid after normalization but memory doesn't exist
            expect(result.error.code).toBe('MEMORY_NOT_FOUND');
        });

        it('should handle tags with special characters', async () => {
            const slugPath = 'project/special-tags';
            const memoryContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-01T00:00:00.000Z',
                'tags: [tag-with-dash, tag.with.dots]',
                'source: test',
                '---',
                'Tags with special characters.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            expect(result.value.output.value.metadata.tags).toEqual([
                'tag-with-dash',
                'tag.with.dots',
            ]);
        });

        it('should handle memory with list-style tags', async () => {
            const slugPath = 'project/list-tags';
            const memoryContent = [
                '---',
                'created_at: 2024-01-01T00:00:00.000Z',
                'updated_at: 2024-01-01T00:00:00.000Z',
                'tags:',
                '  - first-tag',
                '  - second-tag',
                'source: test',
                '---',
                'List-style tags.',
            ].join('\n');

            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.output.kind).toBe('memory');
            if (result.value.output.kind !== 'memory') {
                return;
            }

            expect(result.value.output.value.metadata.tags).toEqual(['first-tag', 'second-tag']);
        });
    });

    describe('format flag', () => {
        const slugPath = 'project/format-test';
        const memoryContent = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-01T00:00:00.000Z',
            'tags: [test]',
            'source: user',
            '---',
            'Format test content.',
        ].join('\n');

        it('should accept --format yaml', async () => {
            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath, '--format', 'yaml']));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.format).toBe('yaml');
        });

        it('should accept --format json', async () => {
            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath, '--format', 'json']));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.format).toBe('json');
        });

        it('should accept --format toon', async () => {
            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath, '--format', 'toon']));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.format).toBe('toon');
        });

        it('should default to yaml when format not specified', async () => {
            await createMemoryFile(tempDir, slugPath, memoryContent);

            const result = await runShowCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.format).toBe('yaml');
        });

        it('should return INVALID_ARGUMENTS for --format without value', async () => {
            const result = await runShowCommand(buildOptions(['some/path', '--format']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('--format');
        });

        it('should return INVALID_ARGUMENTS for invalid format value', async () => {
            const result = await runShowCommand(buildOptions(['some/path', '--format', 'xml']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('--format');
        });
    });
});
