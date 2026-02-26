import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import {
    CategoryPath,
    Cortex,
    Memory,
    MemoryPath,
    ok,
    type Category,
    type ConfigStores,
    type CortexContext,
    type CortexSettings,
    type MemoryMetadata,
    type AdapterFactory,
    type StorageAdapter,
} from '@yeseh/cortex-core';

import { handleList } from './list.ts';
import { handleMove } from './move.ts';
import { handleRemove } from './remove.ts';
import { handleShow } from './show.ts';
import { handleUpdate } from './update.ts';

const createMockAdapter = (overrides: Record<string, unknown> = {}): StorageAdapter =>
    ({
        memories: {
            load: async () => ok(null),
            save: async () => ok(undefined),
            add: async () => ok(undefined),
            remove: async () => ok(undefined),
            move: async () => ok(undefined),
            ...(overrides.memories as object | undefined),
        },
        indexes: {
            load: async () => ok(null),
            write: async () => ok(undefined),
            reindex: async () => ok({ warnings: [] }),
            updateAfterMemoryWrite: async () => ok(undefined),
            ...(overrides.indexes as object | undefined),
        },
        categories: {
            exists: async () => ok(true),
            ensure: async () => ok(undefined),
            delete: async () => ok(undefined),
            setDescription: async () => ok(undefined),
            ...(overrides.categories as object | undefined),
        },
    }) as unknown as StorageAdapter;

const createMemoryFixture = (
    path: string,
    overrides: Partial<MemoryMetadata> = {},
    content = 'Memory content',
): Memory => {
    const timestamp = new Date('2025-01-01T00:00:00.000Z');
    const metadata: MemoryMetadata = {
        createdAt: timestamp,
        updatedAt: timestamp,
        tags: ['test'],
        source: 'user',
        citations: [],
        ...overrides,
    };

    const result = Memory.init(path, metadata, content);
    if (!result.ok()) {
        throw new Error('Test setup failed to create memory.');
    }

    return result.value;
};

const createCaptureStream = (): { stream: PassThrough; getOutput: () => string } => {
    let output = '';

    const stream = new PassThrough();
    const originalWrite = stream.write.bind(stream);
    stream.write = ((
        chunk: Buffer | string,
        encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
        cb?: (error: Error | null | undefined) => void,
    ) => {
        output += Buffer.from(chunk as Buffer).toString(
            typeof encoding === 'string' ? (encoding as BufferEncoding) : undefined,
        );
        return originalWrite(
            chunk as Buffer,
            encoding as BufferEncoding,
            cb as () => void,
        );
    }) as typeof stream.write;

    return {
        stream,
        getOutput: () => output,
    };
};

const createContext = (options: {
    adapter: StorageAdapter;
    storePath: string;
    stdout?: PassThrough;
    stdin?: PassThrough;
    stores?: ConfigStores;
    settings?: CortexSettings;
    now?: () => Date;
}): CortexContext => {
    const cortex = Cortex.init({
        settings: options.settings ?? {},
        stores: options.stores ?? {
            default: {
                kind: 'filesystem',
                properties: { path: options.storePath },
                categories: {},
            },
        },
        adapterFactory: () => options.adapter,
    });

    return {
        cortex,
        settings: options.settings ?? {},
        stores:
            options.stores ??
            ({
                default: {
                    kind: 'filesystem',
                    properties: { path: options.storePath },
                    categories: {},
                },
            } as ConfigStores),
        now: options.now ?? (() => new Date('2025-01-01T00:00:00.000Z')),
        stdin: (options.stdin ?? new PassThrough()) as unknown as NodeJS.ReadStream,
        stdout: (options.stdout ?? new PassThrough()) as unknown as NodeJS.WriteStream,
    };
};

describe('memory command handlers', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-cli-memory-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    describe('handleList', () => {
        it('should throw InvalidArgumentError for invalid category paths', async () => {
            const ctx = createContext({ adapter: createMockAdapter(), storePath: tempDir });

            await expect(handleList(ctx, undefined, '/ /', { format: 'yaml' })).rejects.toThrow(
                InvalidArgumentError,
            );
        });

        it('should throw CommanderError when the adapter factory returns nothing', async () => {
            // Force StoreClient.init to fail by providing a factory that returns undefined/null
            const nullFactory = (() => undefined) as unknown as AdapterFactory;
            const cortex = Cortex.init({
                stores: {
                    default: {
                        kind: 'filesystem',
                        properties: { path: tempDir },
                        categories: {},
                    },
                },
                adapterFactory: nullFactory,
            });
            const ctx: CortexContext = {
                cortex,
                settings: {} as CortexSettings,
                stores: {} as ConfigStores,
                now: () => new Date(),
                stdin: new PassThrough() as unknown as NodeJS.ReadStream,
                stdout: new PassThrough() as unknown as NodeJS.WriteStream,
            };

            await expect(
                handleList(ctx, 'missing-store', undefined, {}),
            ).rejects.toThrow(CommanderError);
        });

        it('should write serialized list output', async () => {
            const memoryPath = MemoryPath.fromString('project/one');
            if (!memoryPath.ok()) {
                throw new Error('Test setup failed to create memory path.');
            }
            const memory = createMemoryFixture('project/one');

            const rootCategory: Category = {
                memories: [],
                subcategories: [{
                    path: CategoryPath.fromString('project').unwrap(),
                    memoryCount: 1,
                    description: 'Project memories',
                }],
            };

            const projectCategory: Category = {
                memories: [{
                    path: memoryPath.value,
                    tokenEstimate: 42,
                }],
                subcategories: [],
            };

            const adapter = createMockAdapter({
                indexes: {
                    load: async (path: CategoryPath) => {
                        if (path.isRoot) {
                            return ok(rootCategory);
                        }
                        if (path.toString() === 'project') {
                            return ok(projectCategory);
                        }
                        return ok(null);
                    },
                },
                memories: {
                    load: async () => ok(memory),
                },
            });

            const capture = createCaptureStream();
            const ctx = createContext({
                adapter,
                storePath: tempDir,
                stdout: capture.stream,
            });

            await handleList(ctx, undefined, undefined, { format: 'json' });

            const output = JSON.parse(capture.getOutput());
            expect(output.memories).toHaveLength(1);
            expect(output.memories[0].path).toBe('project/one');
            expect(output.subcategories[0].path).toBe('project');
        });
    });

    describe('handleShow', () => {
        it('should throw InvalidArgumentError for invalid memory paths', async () => {
            const ctx = createContext({ adapter: createMockAdapter(), storePath: tempDir });

            await expect(handleShow(ctx, undefined, 'invalid', { format: 'yaml' })).rejects.toThrow(
                InvalidArgumentError,
            );
        });

        it('should throw CommanderError when store is missing', async () => {
            const ctx = createContext({
                adapter: createMockAdapter(),
                storePath: tempDir,
                stores: undefined,
            });

            await expect(
                handleShow(ctx, 'missing-store', 'project/one', { format: 'yaml' }),
            ).rejects.toThrow(CommanderError);
        });

        it('should output serialized memory details', async () => {
            const memory = createMemoryFixture('project/show', {}, 'Show content');
            const adapter = createMockAdapter({
                memories: {
                    load: async () => ok(memory),
                },
            });
            const capture = createCaptureStream();
            const ctx = createContext({
                adapter,
                storePath: tempDir,
                stdout: capture.stream,
            });

            await handleShow(ctx, undefined, 'project/show', { format: 'json' });

            const output = JSON.parse(capture.getOutput());
            expect(output.path).toBe('project/show');
            expect(output.content).toBe('Show content');
            expect(output.metadata.tags).toEqual(['test']);
        });
    });

    describe('handleMove', () => {
        it('should throw InvalidArgumentError for invalid memory paths', async () => {
            const ctx = createContext({ adapter: createMockAdapter(), storePath: tempDir });

            await expect(handleMove(ctx, undefined, 'invalid', 'project/two')).rejects.toThrow(
                InvalidArgumentError,
            );
        });

        it('should throw CommanderError when store is missing', async () => {
            const ctx = createContext({
                adapter: createMockAdapter(),
                storePath: tempDir,
                stores: undefined,
            });

            await expect(
                handleMove(ctx, 'missing-store', 'project/one', 'project/two'),
            ).rejects.toThrow(CommanderError);
        });

        it('should move memory and report output', async () => {
            const memory = createMemoryFixture('project/from');
            const moveCalls: { from: MemoryPath; to: MemoryPath }[] = [];

            const adapter = createMockAdapter({
                memories: {
                    load: async (path: MemoryPath) => {
                        if (path.toString() === 'project/from') {
                            return ok(memory);
                        }
                        return ok(null);
                    },
                    move: async (from: MemoryPath, to: MemoryPath) => {
                        moveCalls.push({ from, to });
                        return ok(undefined);
                    },
                },
            });

            const capture = createCaptureStream();
            const ctx = createContext({
                adapter,
                storePath: tempDir,
                stdout: capture.stream,
            });

            await handleMove(ctx, undefined, 'project/from', 'project/to');

            expect(moveCalls).toHaveLength(1);
            if (moveCalls[0]) {
                expect(moveCalls[0].from.toString()).toBe('project/from');
                expect(moveCalls[0].to.toString()).toBe('project/to');
            }
            expect(capture.getOutput()).toContain('Moved memory project/from to project/to');
        });
    });

    describe('handleRemove', () => {
        it('should throw InvalidArgumentError for invalid memory paths', async () => {
            const ctx = createContext({ adapter: createMockAdapter(), storePath: tempDir });

            await expect(handleRemove(ctx, undefined, 'invalid')).rejects.toThrow(
                InvalidArgumentError,
            );
        });

        it('should throw CommanderError when store is missing', async () => {
            const ctx = createContext({
                adapter: createMockAdapter(),
                storePath: tempDir,
                stores: undefined,
            });

            await expect(handleRemove(ctx, 'missing-store', 'project/one')).rejects.toThrow(
                CommanderError,
            );
        });

        it('should remove memory and report output', async () => {
            const memory = createMemoryFixture('project/remove');
            const removeCalls: MemoryPath[] = [];

            const adapter = createMockAdapter({
                memories: {
                    load: async () => ok(memory),
                    remove: async (path: MemoryPath) => {
                        removeCalls.push(path);
                        return ok(undefined);
                    },
                },
            });

            const capture = createCaptureStream();
            const ctx = createContext({
                adapter,
                storePath: tempDir,
                stdout: capture.stream,
            });

            await handleRemove(ctx, undefined, 'project/remove');

            expect(removeCalls).toHaveLength(1);
            if (removeCalls[0]) {
                expect(removeCalls[0].toString()).toBe('project/remove');
            }
            expect(capture.getOutput()).toContain('Removed memory project/remove.');
        });
    });

    describe('handleUpdate', () => {
        it('should throw InvalidArgumentError for invalid memory paths', async () => {
            const ctx = createContext({ adapter: createMockAdapter(), storePath: tempDir });

            await expect(
                handleUpdate(ctx, undefined, 'invalid', { content: 'Next' }),
            ).rejects.toThrow(InvalidArgumentError);
        });

        it('should throw CommanderError when store is missing', async () => {
            const ctx = createContext({
                adapter: createMockAdapter(),
                storePath: tempDir,
                stores: undefined,
            });

            await expect(
                handleUpdate(ctx, 'missing-store', 'project/one', { content: 'Next' }),
            ).rejects.toThrow(CommanderError);
        });

        it('should update memory and report output', async () => {
            const memory = createMemoryFixture('project/update', {}, 'Original content');
            const writeCalls: Memory[] = [];

            const adapter = createMockAdapter({
                memories: {
                    load: async () => ok(memory),
                    save: async (_: MemoryPath, next: Memory) => {
                        writeCalls.push(next);
                        return ok(undefined);
                    },
                },
                indexes: {
                    updateAfterMemoryWrite: async () => ok(undefined),
                },
            });

            const capture = createCaptureStream();
            const ctx = createContext({
                adapter,
                storePath: tempDir,
                stdout: capture.stream,
            });

            await handleUpdate(ctx, undefined, 'project/update', {
                content: 'Updated content',
                tags: ['new-tag'],
            });

            expect(writeCalls).toHaveLength(1);
            if (writeCalls[0]) {
                expect(writeCalls[0].content).toBe('Updated content');
                expect(writeCalls[0].metadata.tags).toEqual(['new-tag']);
            }
            expect(capture.getOutput()).toContain('Updated memory project/update.');
        });
    });
});
