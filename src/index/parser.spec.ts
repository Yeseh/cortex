import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultTokenizer } from '../core/tokens.ts';
import { parseCategoryIndex, serializeCategoryIndex } from './parser.ts';
import { FilesystemStorageAdapter } from '../storage/filesystem.ts';
import { runReindexCommand } from '../cli/commands/reindex.ts';

describe('category index parsing and serialization', () => {
    it('should round-trip serialized indexes', () => {
        const index = {
            memories: [
                {
                    path: 'working/preferences',
                    tokenEstimate: 5,
                    summary: 'User preferences',
                },
            ],
            subcategories: [{ path: 'semantic/concepts', memoryCount: 3 }],
        };

        const serialized = serializeCategoryIndex(index);

        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
            return;
        }

        const parsed = parseCategoryIndex(serialized.value);

        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.value).toEqual(index);
        }
    });

    it('should reject invalid list formatting', () => {
        const raw = [
            'memories:',
            '  path: working/preferences',
            '  token_estimate: 3',
            'subcategories:',
        ].join('\n');

        const result = parseCategoryIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FORMAT');
            expect(result.error.line).toBe(2);
        }
    });

    it('should reject unknown index entry keys', () => {
        const raw = [
            'memories:',
            '  -',
            '    path: working/preferences',
            '    token_estimate: 3',
            '    extra: nope',
            'subcategories: []',
        ].join('\n');

        const result = parseCategoryIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_ENTRY');
            expect(result.error.field).toBe('extra');
            expect(result.error.line).toBe(5);
        }
    });
});

describe('index maintenance', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-index-tests-'));
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should update category indexes on memory writes', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });
        const semanticContent = 'Priority cues summary';
        const semanticPriorityContent = 'Urgent priorities';
        const semanticPriorityBacklogContent = 'Backlog priorities';
        const semanticPriorityDeepContent = 'Deep priorities';

        const writeSemantic = await adapter.writeMemoryFile(
            'semantic/concepts/priority-cues',
            semanticContent
        );

        expect(writeSemantic.ok).toBe(true);
        if (!writeSemantic.ok) {
            return;
        }

        const semanticIndexContents = await adapter.readIndexFile('semantic/concepts');
        expect(semanticIndexContents.ok).toBe(true);
        if (!semanticIndexContents.ok || !semanticIndexContents.value) {
            return;
        }

        const semanticParsed = parseCategoryIndex(semanticIndexContents.value);
        expect(semanticParsed.ok).toBe(true);
        if (semanticParsed.ok) {
            const estimate = defaultTokenizer.estimateTokens(semanticContent);
            expect(estimate.ok).toBe(true);
            if (estimate.ok) {
                expect(semanticParsed.value.memories).toEqual([
                    {
                        path: 'semantic/concepts/priority-cues',
                        tokenEstimate: estimate.value,
                    },
                ]);
            }
        }

        const parentIndexContents = await adapter.readIndexFile('semantic');
        expect(parentIndexContents.ok).toBe(true);
        if (!parentIndexContents.ok || !parentIndexContents.value) {
            return;
        }

        const parentParsed = parseCategoryIndex(parentIndexContents.value);
        expect(parentParsed.ok).toBe(true);
        if (parentParsed.ok) {
            expect(parentParsed.value.subcategories).toEqual([
                { path: 'semantic/concepts', memoryCount: 1 },
            ]);
        }

        const writeSemanticPriority = await adapter.writeMemoryFile(
            'semantic/priorities/urgent',
            semanticPriorityContent
        );

        expect(writeSemanticPriority.ok).toBe(true);
        if (!writeSemanticPriority.ok) {
            return;
        }

        const writeSemanticPriorityBacklog = await adapter.writeMemoryFile(
            'semantic/priorities/backlog',
            semanticPriorityBacklogContent
        );

        expect(writeSemanticPriorityBacklog.ok).toBe(true);
        if (!writeSemanticPriorityBacklog.ok) {
            return;
        }

        const priorityIndexContents = await adapter.readIndexFile('semantic/priorities');
        expect(priorityIndexContents.ok).toBe(true);
        if (!priorityIndexContents.ok || !priorityIndexContents.value) {
            return;
        }

        const priorityParsed = parseCategoryIndex(priorityIndexContents.value);
        expect(priorityParsed.ok).toBe(true);
        if (priorityParsed.ok) {
            const estimate = defaultTokenizer.estimateTokens(semanticPriorityContent);
            const backlogEstimate = defaultTokenizer.estimateTokens(semanticPriorityBacklogContent);
            expect(estimate.ok).toBe(true);
            expect(backlogEstimate.ok).toBe(true);
            if (estimate.ok && backlogEstimate.ok) {
                expect(priorityParsed.value.memories).toEqual([
                    {
                        path: 'semantic/priorities/backlog',
                        tokenEstimate: backlogEstimate.value,
                    },
                    {
                        path: 'semantic/priorities/urgent',
                        tokenEstimate: estimate.value,
                    },
                ]);
            }
        }

        const writeSemanticPriorityDeep = await adapter.writeMemoryFile(
            'semantic/priorities/urgent/deep',
            semanticPriorityDeepContent
        );

        expect(writeSemanticPriorityDeep.ok).toBe(true);
        if (!writeSemanticPriorityDeep.ok) {
            return;
        }

        const deepIndexContents = await adapter.readIndexFile('semantic/priorities/urgent');
        expect(deepIndexContents.ok).toBe(true);
        if (!deepIndexContents.ok || !deepIndexContents.value) {
            return;
        }

        const deepParsed = parseCategoryIndex(deepIndexContents.value);
        expect(deepParsed.ok).toBe(true);
        if (deepParsed.ok) {
            const deepEstimate = defaultTokenizer.estimateTokens(semanticPriorityDeepContent);
            expect(deepEstimate.ok).toBe(true);
            if (deepEstimate.ok) {
                expect(deepParsed.value.memories).toEqual([
                    {
                        path: 'semantic/priorities/urgent/deep',
                        tokenEstimate: deepEstimate.value,
                    },
                ]);
            }
        }

        const updatedParentIndexContents = await adapter.readIndexFile('semantic');
        expect(updatedParentIndexContents.ok).toBe(true);
        if (!updatedParentIndexContents.ok || !updatedParentIndexContents.value) {
            return;
        }

        const updatedParentParsed = parseCategoryIndex(updatedParentIndexContents.value);
        expect(updatedParentParsed.ok).toBe(true);
        if (updatedParentParsed.ok) {
            expect(updatedParentParsed.value.subcategories).toEqual([
                { path: 'semantic/concepts', memoryCount: 1 },
                { path: 'semantic/priorities', memoryCount: 2 },
            ]);
        }

        const priorityParentIndexContents = await adapter.readIndexFile('semantic/priorities');
        expect(priorityParentIndexContents.ok).toBe(true);
        if (!priorityParentIndexContents.ok || !priorityParentIndexContents.value) {
            return;
        }

        const priorityParentParsed = parseCategoryIndex(priorityParentIndexContents.value);
        expect(priorityParentParsed.ok).toBe(true);
        if (priorityParentParsed.ok) {
            expect(priorityParentParsed.value.subcategories).toEqual([
                { path: 'semantic/priorities/urgent', memoryCount: 1 },
            ]);
        }

        const writeWorking = await adapter.writeMemoryFile(
            'working/preferences',
            'Prefers result-style errors.'
        );

        expect(writeWorking.ok).toBe(true);
        if (!writeWorking.ok) {
            return;
        }

        const workingIndexContents = await adapter.readIndexFile('working');
        expect(workingIndexContents.ok).toBe(true);
        if (!workingIndexContents.ok || !workingIndexContents.value) {
            return;
        }

        const workingParsed = parseCategoryIndex(workingIndexContents.value);
        expect(workingParsed.ok).toBe(true);
        if (workingParsed.ok) {
            expect(workingParsed.value.memories).toHaveLength(1);
            expect(workingParsed.value.memories[0]?.path).toBe('working/preferences');
        }

        const updatedContent = 'Prefers result-style errors with context.';
        const writeWorkingUpdate = await adapter.writeMemoryFile(
            'working/preferences',
            updatedContent
        );

        expect(writeWorkingUpdate.ok).toBe(true);
        if (!writeWorkingUpdate.ok) {
            return;
        }

        const updatedWorkingIndexContents = await adapter.readIndexFile('working');
        expect(updatedWorkingIndexContents.ok).toBe(true);
        if (!updatedWorkingIndexContents.ok || !updatedWorkingIndexContents.value) {
            return;
        }

        const updatedWorkingParsed = parseCategoryIndex(updatedWorkingIndexContents.value);
        expect(updatedWorkingParsed.ok).toBe(true);
        if (updatedWorkingParsed.ok) {
            const updatedEstimate = defaultTokenizer.estimateTokens(updatedContent);
            expect(updatedEstimate.ok).toBe(true);
            if (updatedEstimate.ok) {
                expect(updatedWorkingParsed.value.memories).toEqual([
                    {
                        path: 'working/preferences',
                        tokenEstimate: updatedEstimate.value,
                    },
                ]);
            }
        }
    });

    it('should rebuild indexes during manual reindex', async () => {
        const memoryRoot = join(tempDir, 'memories');
        await mkdir(join(memoryRoot, 'working'), { recursive: true });
        await mkdir(join(memoryRoot, 'semantic', 'concepts'), { recursive: true });
        await mkdir(join(memoryRoot, 'semantic', 'priorities'), { recursive: true });
        await mkdir(join(memoryRoot, 'semantic', 'priorities', 'urgent'), { recursive: true });
        await writeFile(join(memoryRoot, 'working', 'notes.md'), 'Working notes');
        await writeFile(
            join(memoryRoot, 'semantic', 'concepts', 'priority.md'),
            'Priority content'
        );
        await writeFile(join(memoryRoot, 'semantic', 'priorities', 'urgent.md'), 'Urgent priority');
        await writeFile(
            join(memoryRoot, 'semantic', 'priorities', 'backlog.md'),
            'Backlog priority'
        );
        await writeFile(
            join(memoryRoot, 'semantic', 'priorities', 'urgent', 'deep.md'),
            'Deep priority'
        );

        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });
        const legacyIndexWrite = await adapter.writeIndexFile(
            'legacy',
            'memories:\n\nsubcategories:'
        );
        expect(legacyIndexWrite.ok).toBe(true);

        const reindexResult = await adapter.reindexCategoryIndexes();

        expect(reindexResult.ok).toBe(true);
        if (!reindexResult.ok) {
            return;
        }

        const workingIndexContents = await adapter.readIndexFile('working');
        expect(workingIndexContents.ok).toBe(true);
        if (workingIndexContents.ok && workingIndexContents.value) {
            const workingParsed = parseCategoryIndex(workingIndexContents.value);
            expect(workingParsed.ok).toBe(true);
            if (workingParsed.ok) {
                const estimate = defaultTokenizer.estimateTokens('Working notes');
                expect(estimate.ok).toBe(true);
                if (estimate.ok) {
                    expect(workingParsed.value.memories).toEqual([
                        { path: 'working/notes', tokenEstimate: estimate.value },
                    ]);
                }
            }
        }

        const semanticIndexContents = await adapter.readIndexFile('semantic/concepts');
        expect(semanticIndexContents.ok).toBe(true);
        if (semanticIndexContents.ok && semanticIndexContents.value) {
            const semanticParsed = parseCategoryIndex(semanticIndexContents.value);
            expect(semanticParsed.ok).toBe(true);
            if (semanticParsed.ok) {
                const estimate = defaultTokenizer.estimateTokens('Priority content');
                expect(estimate.ok).toBe(true);
                if (estimate.ok) {
                    expect(semanticParsed.value.memories).toEqual([
                        { path: 'semantic/concepts/priority', tokenEstimate: estimate.value },
                    ]);
                }
            }
        }

        const priorityIndexContents = await adapter.readIndexFile('semantic/priorities');
        expect(priorityIndexContents.ok).toBe(true);
        if (priorityIndexContents.ok && priorityIndexContents.value) {
            const priorityParsed = parseCategoryIndex(priorityIndexContents.value);
            expect(priorityParsed.ok).toBe(true);
            if (priorityParsed.ok) {
                const estimate = defaultTokenizer.estimateTokens('Urgent priority');
                const backlogEstimate = defaultTokenizer.estimateTokens('Backlog priority');
                expect(estimate.ok).toBe(true);
                expect(backlogEstimate.ok).toBe(true);
                if (estimate.ok && backlogEstimate.ok) {
                    expect(priorityParsed.value.memories).toEqual([
                        {
                            path: 'semantic/priorities/backlog',
                            tokenEstimate: backlogEstimate.value,
                        },
                        {
                            path: 'semantic/priorities/urgent',
                            tokenEstimate: estimate.value,
                        },
                    ]);
                }
            }
        }

        const urgentIndexContents = await adapter.readIndexFile('semantic/priorities/urgent');
        expect(urgentIndexContents.ok).toBe(true);
        if (urgentIndexContents.ok && urgentIndexContents.value) {
            const urgentParsed = parseCategoryIndex(urgentIndexContents.value);
            expect(urgentParsed.ok).toBe(true);
            if (urgentParsed.ok) {
                const deepEstimate = defaultTokenizer.estimateTokens('Deep priority');
                expect(deepEstimate.ok).toBe(true);
                if (deepEstimate.ok) {
                    expect(urgentParsed.value.memories).toEqual([
                        {
                            path: 'semantic/priorities/urgent/deep',
                            tokenEstimate: deepEstimate.value,
                        },
                    ]);
                }
            }
        }

        const parentIndexContents = await adapter.readIndexFile('semantic');
        expect(parentIndexContents.ok).toBe(true);
        if (parentIndexContents.ok && parentIndexContents.value) {
            const parentParsed = parseCategoryIndex(parentIndexContents.value);
            expect(parentParsed.ok).toBe(true);
            if (parentParsed.ok) {
                expect(parentParsed.value.memories).toEqual([]);
                expect(parentParsed.value.subcategories).toEqual([
                    { path: 'semantic/concepts', memoryCount: 1 },
                    { path: 'semantic/priorities', memoryCount: 2 },
                ]);
            }
        }

        const priorityParentIndexContents = await adapter.readIndexFile('semantic/priorities');
        expect(priorityParentIndexContents.ok).toBe(true);
        if (priorityParentIndexContents.ok && priorityParentIndexContents.value) {
            const priorityParentParsed = parseCategoryIndex(priorityParentIndexContents.value);
            expect(priorityParentParsed.ok).toBe(true);
            if (priorityParentParsed.ok) {
                expect(priorityParentParsed.value.subcategories).toEqual([
                    { path: 'semantic/priorities/urgent', memoryCount: 1 },
                ]);
            }
        }

        const legacyIndexContents = await adapter.readIndexFile('legacy');
        expect(legacyIndexContents.ok).toBe(true);
        if (legacyIndexContents.ok) {
            expect(legacyIndexContents.value).toBeNull();
        }
    });

    it('should reject unexpected reindex args', async () => {
        const result = await runReindexCommand({
            storeRoot: tempDir,
            args: ['unexpected'],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.details?.args).toEqual(['unexpected']);
        }
    });
});
