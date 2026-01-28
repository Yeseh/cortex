import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runRemoveCommand } from './remove.ts';

describe('remove CLI command', () => {
    let tempDir: string;

    const buildOptions = (args: string[]) => ({
        storeRoot: tempDir,
        args,
    });

    const createMemoryFile = async (storeRoot: string, slugPath: string) => {
        const content = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [test]',
            'source: user',
            '---',
            'Test content.',
        ].join('\n');
        const memoryDir = join(storeRoot, ...slugPath.split('/').slice(0, -1));
        await mkdir(memoryDir, { recursive: true });
        const filePath = join(storeRoot, `${slugPath}.md`);
        await writeFile(filePath, content, 'utf8');
    };

    const memoryExists = async (storeRoot: string, slugPath: string): Promise<boolean> => {
        try {
            await access(join(storeRoot, `${slugPath}.md`));
            return true;
        }
        catch {
            return false;
        }
    };

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-remove-cli-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('success cases', () => {
        it('should remove an existing memory', async () => {
            const slugPath = 'project/feature-notes';
            await createMemoryFile(tempDir, slugPath);

            // Verify memory exists before removal
            expect(await memoryExists(tempDir, slugPath)).toBe(true);

            const result = await runRemoveCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.message).toContain(slugPath);
            expect(result.value.message).toContain('Removed');

            // Verify memory no longer exists
            expect(await memoryExists(tempDir, slugPath)).toBe(false);
        });

        it('should be idempotent when removing non-existent memory', async () => {
            const slugPath = 'project/non-existent-memory';

            // Verify memory does not exist
            expect(await memoryExists(tempDir, slugPath)).toBe(false);

            const result = await runRemoveCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.message).toContain(slugPath);
            expect(result.value.message).toContain('Removed');
        });

        it('should remove memory with deep category path', async () => {
            const slugPath = 'domain/subdomain/feature/my-memory';
            await createMemoryFile(tempDir, slugPath);

            expect(await memoryExists(tempDir, slugPath)).toBe(true);

            const result = await runRemoveCommand(buildOptions([slugPath]));

            expect(result.ok).toBe(true);
            if (!result.ok) {
                return;
            }

            expect(result.value.message).toContain(slugPath);
            expect(await memoryExists(tempDir, slugPath)).toBe(false);
        });
    });

    describe('error cases', () => {
        it('should return INVALID_ARGUMENTS when args are empty', async () => {
            const result = await runRemoveCommand(buildOptions([]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('required');
        });

        it('should return INVALID_ARGUMENTS for unknown flag', async () => {
            const result = await runRemoveCommand(buildOptions([
                '--force', 'project/memory',
            ]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Unknown flag');
            expect(result.error.message).toContain('--force');
        });

        it('should return INVALID_ARGUMENTS for unknown short flag', async () => {
            const result = await runRemoveCommand(buildOptions([
                '-f', 'project/memory',
            ]));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Unknown flag');
            expect(result.error.message).toContain('-f');
        });

        it('should return INVALID_ARGUMENTS for too many positional arguments', async () => {
            const result = await runRemoveCommand(
                buildOptions([
                    'project/memory-one', 'project/memory-two',
                ]),
            );

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('Too many arguments');
        });

        it('should return INVALID_PATH for slug path missing category', async () => {
            const result = await runRemoveCommand(buildOptions(['single-segment']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_PATH');
            expect(result.error.message).toContain('at least two segments');
        });

        it('should return INVALID_PATH for trailing slash in path', async () => {
            // A path like "/" results in empty segments after normalization
            const result = await runRemoveCommand(buildOptions(['/']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_PATH');
        });

        it('should return INVALID_PATH for slug path with invalid characters', async () => {
            const result = await runRemoveCommand(buildOptions(['Project/Memory_Name']));

            expect(result.ok).toBe(false);
            if (result.ok) {
                return;
            }

            expect(result.error.code).toBe('INVALID_PATH');
            expect(result.error.message).toContain('lowercase');
        });
    });
});
