import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    CategoryPath,
    MemoryPath,
    ok,
    testContext,
    type AdapterFactory,
    type Category,
    type CortexContext,
} from '@yeseh/cortex-core';

import { handleList } from './list.ts';
import {
    createCaptureStream,
    createMemoryCommandContext,
    createMemoryFixture,
    createMockMemoryCommandAdapter,
} from './test-helpers.spec.ts';

describe('handleList', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-cli-memory-list-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should throw InvalidArgumentError for invalid category paths', async () => {
        const ctx = createMemoryCommandContext({
            adapter: createMockMemoryCommandAdapter(),
            storePath: tempDir,
        });

        await expect(handleList(ctx, undefined, '/ /', { format: 'yaml' })).rejects.toThrow(
            InvalidArgumentError,
        );
    });

    it('should throw CommanderError when the adapter factory returns nothing', async () => {
        const nullFactory = (() => undefined) as unknown as AdapterFactory;
        const ctx: CortexContext = testContext({
            adapterFactory: nullFactory,
            stores: {
                default: {
                    kind: 'filesystem',
                    properties: { path: tempDir },
                    categories: {},
                },
            },
            storePath: tempDir,
        });

        await expect(handleList(ctx, 'missing-store', undefined, {})).rejects.toThrow(
            CommanderError,
        );
    });

    it('should write serialized list output', async () => {
        const memoryPath = MemoryPath.fromString('project/one');
        if (!memoryPath.ok()) {
            throw new Error('Test setup failed to create memory path.');
        }
        const memory = createMemoryFixture('project/one');

        const rootCategory: Category = {
            memories: [],
            subcategories: [
                {
                    path: CategoryPath.fromString('project').unwrap(),
                    memoryCount: 1,
                    description: 'Project memories',
                },
            ],
        };

        const projectCategory: Category = {
            memories: [
                {
                    path: memoryPath.value,
                    tokenEstimate: 42,
                },
            ],
            subcategories: [],
        };

        const adapter = createMockMemoryCommandAdapter({
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
        const ctx = createMemoryCommandContext({
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
