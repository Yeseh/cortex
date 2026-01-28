/**
 * Tests for the prune command
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runPruneCommand } from './prune.ts';

const TEST_ROOT = join(import.meta.dir, '../../../.test-prune-command');

const createMemoryFile = async (
    slugPath: string,
    options: { expiresAt?: Date } = {},
): Promise<void> => {
    const filePath = join(TEST_ROOT, `${slugPath}.md`);
    const dir = filePath.split(/[/\\]/).slice(0, -1).join('/');
    await mkdir(dir, { recursive: true });

    const now = new Date();
    const lines = [
        '---',
        `created_at: ${now.toISOString()}`,
        `updated_at: ${now.toISOString()}`,
        'tags: []',
        'source: test',
    ];
    if (options.expiresAt) {
        lines.push(`expires_at: ${options.expiresAt.toISOString()}`);
    }
    lines.push('---', '', 'Test memory content');

    await writeFile(filePath, lines.join('\n'), 'utf8');
};

const createIndex = async (
    category: string,
    memories: { path: string; tokenEstimate: number }[],
): Promise<void> => {
    const filePath = join(TEST_ROOT, category, 'index.yaml');
    const dir = filePath.split(/[/\\]/).slice(0, -1).join('/');
    await mkdir(dir, { recursive: true });

    const lines = ['memories:'];
    for (const memory of memories) {
        lines.push(
            '  -',
            `    path: ${memory.path}`,
            `    token_estimate: ${memory.tokenEstimate}`,
        );
    }
    lines.push('', 'subcategories: []');

    await writeFile(filePath, lines.join('\n'), 'utf8');
};

const fileExists = async (path: string): Promise<boolean> => {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
};

describe('runPruneCommand', () => {
    beforeEach(async () => {
        await rm(TEST_ROOT, { recursive: true, force: true });
        await mkdir(TEST_ROOT, { recursive: true });
    });

    afterEach(async () => {
        await rm(TEST_ROOT, { recursive: true, force: true });
    });

    test('returns no pruned when no expired memories exist', async () => {
        await createMemoryFile('project/active-memory');
        await createIndex('project', [{ path: 'project/active-memory', tokenEstimate: 10 }]);

        const result = await runPruneCommand({
            storeRoot: TEST_ROOT,
            args: [],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.pruned).toHaveLength(0);
            expect(result.value.message).toContain('No expired memories');
        }
    });

    test('deletes expired memories', async () => {
        const pastDate = new Date(Date.now() - 86400000);

        await createMemoryFile('project/expired-memory', { expiresAt: pastDate });
        await createIndex('project', [{ path: 'project/expired-memory', tokenEstimate: 10 }]);

        const memoryPath = join(TEST_ROOT, 'project', 'expired-memory.md');
        expect(await fileExists(memoryPath)).toBe(true);

        const result = await runPruneCommand({
            storeRoot: TEST_ROOT,
            args: [],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.pruned).toHaveLength(1);
            expect(result.value.pruned[0]?.path).toBe('project/expired-memory');
        }

        expect(await fileExists(memoryPath)).toBe(false);
    });

    test('dry run does not delete files', async () => {
        const pastDate = new Date(Date.now() - 86400000);

        await createMemoryFile('project/expired-memory', { expiresAt: pastDate });
        await createIndex('project', [{ path: 'project/expired-memory', tokenEstimate: 10 }]);

        const memoryPath = join(TEST_ROOT, 'project', 'expired-memory.md');

        const result = await runPruneCommand({
            storeRoot: TEST_ROOT,
            args: ['--dry-run'],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.pruned).toHaveLength(1);
            expect(result.value.message).toContain('Would prune');
        }

        expect(await fileExists(memoryPath)).toBe(true);
    });

    test('keeps non-expired memories', async () => {
        const pastDate = new Date(Date.now() - 86400000);
        const futureDate = new Date(Date.now() + 86400000);

        await createMemoryFile('project/expired-memory', { expiresAt: pastDate });
        await createMemoryFile('project/active-memory', { expiresAt: futureDate });
        await createIndex('project', [
            { path: 'project/expired-memory', tokenEstimate: 10 },
            { path: 'project/active-memory', tokenEstimate: 10 },
        ]);

        const expiredPath = join(TEST_ROOT, 'project', 'expired-memory.md');
        const activePath = join(TEST_ROOT, 'project', 'active-memory.md');

        const result = await runPruneCommand({
            storeRoot: TEST_ROOT,
            args: [],
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.pruned).toHaveLength(1);
        }

        expect(await fileExists(expiredPath)).toBe(false);
        expect(await fileExists(activePath)).toBe(true);
    });

    test('rejects unknown flags', async () => {
        const result = await runPruneCommand({
            storeRoot: TEST_ROOT,
            args: ['--unknown'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_ARGUMENTS');
        }
    });

    test('rejects positional arguments', async () => {
        const result = await runPruneCommand({
            storeRoot: TEST_ROOT,
            args: ['some-arg'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_ARGUMENTS');
        }
    });
});
