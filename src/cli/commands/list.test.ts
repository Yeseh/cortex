/**
 * Tests for the list command
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runListCommand } from './list.ts';

const TEST_ROOT = join(
    import.meta.dir, '../../../.test-list-command',
);

const createMemoryFile = async (
    slugPath: string,
    options: { expiresAt?: Date } = {},
): Promise<void> => {
    const filePath = join(
        TEST_ROOT, 'memories', `${slugPath}.md`,
    );
    const dir = filePath.split(/[/\\]/).slice(
        0, -1,
    ).join('/');
    await mkdir(
        dir, { recursive: true },
    );

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
    lines.push(
        '---', '', 'Test memory content',
    );

    await writeFile(
        filePath, lines.join('\n'), 'utf8',
    );
};

const createIndex = async (
    category: string,
    memories: { path: string; tokenEstimate: number }[],
): Promise<void> => {
    const filePath = join(
        TEST_ROOT, 'indexes', `${category}.yml`,
    );
    const dir = filePath.split(/[/\\]/).slice(
        0, -1,
    ).join('/');
    await mkdir(
        dir, { recursive: true },
    );

    const lines = ['memories:'];
    for (const memory of memories) {
        lines.push(
            '  -',
            `    path: ${memory.path}`,
            `    token_estimate: ${memory.tokenEstimate}`,
        ); 
    }
    lines.push(
        '', 'subcategories: []',
    );

    await writeFile(
        filePath, lines.join('\n'), 'utf8',
    );
};

describe(
    'runListCommand', () => {
        beforeEach(async () => {
            await rm(
                TEST_ROOT, { recursive: true, force: true },
            );
            await mkdir(
                TEST_ROOT, { recursive: true },
            );
        });

        afterEach(async () => {
            await rm(
                TEST_ROOT, { recursive: true, force: true },
            ); 
        });

        test(
            'returns empty list when no memories exist', async () => {
                const result = await runListCommand({
                    storeRoot: TEST_ROOT,
                    args: [],
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.memories).toEqual([]); 
                }
            },
        );

        test(
            'lists memories from a category', async () => {
                await createMemoryFile('project/test-memory');
                await createIndex(
                    'project', [{ path: 'project/test-memory', tokenEstimate: 10 }],
                );

                const result = await runListCommand({
                    storeRoot: TEST_ROOT,
                    args: ['project'],
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.memories).toHaveLength(1);
                    expect(result.value.memories[0]?.path).toBe('project/test-memory');
                    expect(result.value.memories[0]?.isExpired).toBe(false);
                }
            },
        );

        test(
            'excludes expired memories by default', async () => {
                const pastDate = new Date(Date.now() - 86400000);
                const futureDate = new Date(Date.now() + 86400000);

                await createMemoryFile(
                    'project/expired-memory', { expiresAt: pastDate },
                );
                await createMemoryFile(
                    'project/active-memory', { expiresAt: futureDate },
                );
                await createIndex(
                    'project', [
                        { path: 'project/expired-memory', tokenEstimate: 10 },
                        { path: 'project/active-memory', tokenEstimate: 10 },
                    ],
                );

                const result = await runListCommand({
                    storeRoot: TEST_ROOT,
                    args: ['project'],
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.memories).toHaveLength(1);
                    expect(result.value.memories[0]?.path).toBe('project/active-memory');
                }
            },
        );

        test(
            'includes expired memories with --include-expired flag', async () => {
                const pastDate = new Date(Date.now() - 86400000);

                await createMemoryFile(
                    'project/expired-memory', { expiresAt: pastDate },
                );
                await createIndex(
                    'project', [{ path: 'project/expired-memory', tokenEstimate: 10 }],
                );

                const result = await runListCommand({
                    storeRoot: TEST_ROOT,
                    args: [
                        'project',
                        '--include-expired', 
                    ],
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.memories).toHaveLength(1);
                    expect(result.value.memories[0]?.path).toBe('project/expired-memory');
                    expect(result.value.memories[0]?.isExpired).toBe(true);
                }
            },
        );

        test(
            'outputs JSON format with --format json', async () => {
                await createMemoryFile('project/test-memory');
                await createIndex(
                    'project', [{ path: 'project/test-memory', tokenEstimate: 10 }],
                );

                const result = await runListCommand({
                    storeRoot: TEST_ROOT,
                    args: [
                        'project',
                        '--format',
                        'json',
                    ],
                });

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.message).toContain('"memories"');
                    const parsed = JSON.parse(result.value.message);
                    expect(parsed.memories).toHaveLength(1);
                }
            },
        );

        test(
            'rejects unknown flags', async () => {
                const result = await runListCommand({
                    storeRoot: TEST_ROOT,
                    args: ['--unknown'],
                });

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_ARGUMENTS'); 
                }
            },
        );
    },
);
