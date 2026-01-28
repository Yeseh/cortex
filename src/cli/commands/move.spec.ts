import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runMoveCommand } from './move.ts';

describe('move CLI command', () => {
    let tempDir: string;
    let storeRoot: string;

    const buildOptions = (args: string[]) => ({
        storeRoot,
        args,
    });

    const createMemoryFile = async (slugPath: string) => {
        const content = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [test]',
            'source: user',
            '---',
            'Test content.',
        ].join('\n');
        const segments = slugPath.split('/');
        const memoryDir = join(storeRoot, ...segments.slice(0, -1));
        await mkdir(memoryDir, { recursive: true });
        const filePath = join(storeRoot, `${slugPath}.md`);
        await writeFile(filePath, content, 'utf8');
    };

    const createCategory = async (categoryPath: string) => {
        const dir = join(storeRoot, ...categoryPath.split('/'));
        await mkdir(dir, { recursive: true });
        // Create index.yaml to mark this as a valid category
        const indexPath = join(dir, 'index.yaml');
        await writeFile(indexPath, 'description: Test category\n', 'utf8');
    };

    const memoryExists = async (slugPath: string): Promise<boolean> => {
        try {
            await access(join(storeRoot, `${slugPath}.md`));
            return true;
        }
        catch {
            return false;
        }
    };

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-move-cli-'));
        storeRoot = join(tempDir, 'store');
        await mkdir(storeRoot, { recursive: true });
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('success cases', () => {
        it('should move memory to existing destination category', async () => {
            await createMemoryFile('source-category/test-memory');
            await createCategory('destination-category');

            const result = await runMoveCommand(
                buildOptions([
                    'source-category/test-memory', 'destination-category/test-memory',
                ]),
            );

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.message).toContain('source-category/test-memory');
            expect(result.value.message).toContain('destination-category/test-memory');

            const sourceExists = await memoryExists('source-category/test-memory');
            expect(sourceExists).toBe(false);

            const destinationExists = await memoryExists('destination-category/test-memory');
            expect(destinationExists).toBe(true);
        });

        it('should move memory to nested destination category', async () => {
            await createMemoryFile('projects/work/old-project');
            await createCategory('archive/2024');

            const result = await runMoveCommand(
                buildOptions([
                    'projects/work/old-project', 'archive/2024/old-project',
                ]),
            );

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            const sourceExists = await memoryExists('projects/work/old-project');
            expect(sourceExists).toBe(false);

            const destinationExists = await memoryExists('archive/2024/old-project');
            expect(destinationExists).toBe(true);
        });

        it('should move memory with different slug name at destination', async () => {
            await createMemoryFile('category/original-name');
            await createCategory('category');

            const result = await runMoveCommand(
                buildOptions([
                    'category/original-name', 'category/renamed-memory',
                ]),
            );

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            const sourceExists = await memoryExists('category/original-name');
            expect(sourceExists).toBe(false);

            const destinationExists = await memoryExists('category/renamed-memory');
            expect(destinationExists).toBe(true);
        });
    });

    describe('argument validation errors', () => {
        it('should return INVALID_ARGUMENTS when args are empty', async () => {
            const result = await runMoveCommand(buildOptions([]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Source and destination paths are required');
        });

        it('should return INVALID_ARGUMENTS when only one argument provided', async () => {
            const result = await runMoveCommand(buildOptions(['source-category/memory']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Destination path is required');
        });

        it('should return INVALID_ARGUMENTS when unknown flag is provided', async () => {
            const result = await runMoveCommand(
                buildOptions([
                    '--verbose',
                    'source-category/memory',
                    'dest-category/memory',
                ]),
            );

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Unknown flag');
            expect(result.error.message).toContain('--verbose');
        });

        it('should return INVALID_ARGUMENTS when too many arguments provided', async () => {
            const result = await runMoveCommand(
                buildOptions([
                    'source/memory',
                    'dest/memory',
                    'extra-argument',
                ]),
            );

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Too many arguments');
        });

        it('should return INVALID_ARGUMENTS for short flags', async () => {
            const result = await runMoveCommand(
                buildOptions([
                    '-f',
                    'source/memory',
                    'dest/memory',
                ]),
            );

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Unknown flag');
        });
    });

    describe('path validation errors', () => {
        it('should return INVALID_SOURCE_PATH when source path has no category', async () => {
            const result = await runMoveCommand(buildOptions([
                'memory-only', 'dest/memory',
            ]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_SOURCE_PATH');
            expect(result.error.message).toContain('at least two segments');
        });

        it('should return INVALID_DESTINATION_PATH when destination path has no category', async () => {
            await createMemoryFile('source/memory');

            const result = await runMoveCommand(buildOptions([
                'source/memory', 'memory-only',
            ]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_DESTINATION_PATH');
            expect(result.error.message).toContain('at least two segments');
        });

        it('should return INVALID_SOURCE_PATH for invalid slug characters in source', async () => {
            const result = await runMoveCommand(
                buildOptions([
                    'Invalid Category/memory', 'dest/memory',
                ]),
            );

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_SOURCE_PATH');
        });

        it('should return INVALID_DESTINATION_PATH for invalid slug characters in destination', async () => {
            await createMemoryFile('source/memory');

            const result = await runMoveCommand(
                buildOptions([
                    'source/memory', 'UPPERCASE/memory',
                ]),
            );

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_DESTINATION_PATH');
        });
    });

    describe('move operation errors', () => {
        it('should return MOVE_FAILED when destination category does not exist', async () => {
            await createMemoryFile('source/memory');

            const result = await runMoveCommand(
                buildOptions([
                    'source/memory', 'nonexistent-category/memory',
                ]),
            );

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('MOVE_FAILED');
            expect(result.error.message).toContain('Destination category does not exist');
        });

        it('should return MOVE_FAILED when source memory does not exist', async () => {
            await createCategory('source');
            await createCategory('destination');

            const result = await runMoveCommand(
                buildOptions([
                    'source/nonexistent-memory', 'destination/memory',
                ]),
            );

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('MOVE_FAILED');
        });

        it('should return MOVE_FAILED when nested destination category does not exist', async () => {
            await createMemoryFile('source/memory');
            await createCategory('archive'); // Only parent exists, not archive/2024

            const result = await runMoveCommand(
                buildOptions([
                    'source/memory', 'archive/2024/memory',
                ]),
            );

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('MOVE_FAILED');
        });
    });

    describe('edge cases', () => {
        it('should handle empty string arguments gracefully', async () => {
            const result = await runMoveCommand(buildOptions([
                '', '',
            ]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
        });

        it('should handle whitespace-only source path', async () => {
            // Whitespace-only paths are not filtered, they pass to validation
            const result = await runMoveCommand(buildOptions([
                '   ', 'dest/memory',
            ]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            // Whitespace results in invalid slug path (no valid segments)
            expect(result.error.code).toBe('INVALID_SOURCE_PATH');
        });

        it('should filter out empty arguments', async () => {
            // Empty strings should be filtered, leaving only one valid arg
            const result = await runMoveCommand(buildOptions([
                '',
                'source/memory',
                '',
            ]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Destination path is required');
        });
    });
});
