/**
 * Unit tests for the handleAdd command handler.
 *
 * @module cli/memory/commands/add.spec
 */

import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { CommanderError, InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import {
    Cortex,
    ok,
    type AdapterFactory,
    type ConfigAdapter,
    type ConfigStores,
    type CortexContext,
    type CortexSettings,
    type StorageAdapter,
} from '@yeseh/cortex-core';
import { handleAdd } from './add.ts';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

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

const createContext = (options: {
    adapter: StorageAdapter;
    storePath: string;
    stdout?: PassThrough;
    stdin?: PassThrough;
    stores?: ConfigStores;
    settings?: CortexSettings;
    now?: () => Date;
    adapterFactory?: AdapterFactory;
}): CortexContext => {
    const stores: ConfigStores = options.stores ?? {
        default: {
            kind: 'filesystem',
            properties: { path: options.storePath },
            categories: {},
        },
    };
    const cortex = Cortex.init({
        settings: options.settings,
        stores,
        adapterFactory: options.adapterFactory ?? (() => options.adapter),
    });

    return {
        cortex,
        config: {
            path: '/tmp/test/config.yaml',
            data: null,
            get stores() {
                return stores;
            },
            get settings() {
                return options.settings ?? null;
            },
            initializeConfig: async () => ok(undefined),
            getSettings: async () => ok(options.settings ?? {}),
            getStores: async () => ok(stores),
            getStore: async (name: string) => ok(stores[name] ?? null),
            saveStore: async () => ok(undefined),
        } as ConfigAdapter,
        settings: (options.settings ?? {}) as CortexSettings,
        stores,
        now: options.now ?? (() => new Date('2025-01-01T00:00:00.000Z')),
        stdin: (options.stdin ?? new PassThrough()) as unknown as NodeJS.ReadStream,
        stdout: (options.stdout ?? new PassThrough()) as unknown as NodeJS.WriteStream,
    };
};

const createCaptureStream = (): { stream: PassThrough; getOutput: () => string } => {
    let output = '';
    const stream = new PassThrough();
    const originalWrite = stream.write.bind(stream);
    stream.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
        output += Buffer.from(chunk as Buffer).toString(
            typeof encoding === 'string' ? (encoding as BufferEncoding) : undefined
        );
        return originalWrite(chunk as Buffer, encoding as BufferEncoding, cb as () => void);
    }) as typeof stream.write;
    return { stream, getOutput: () => output };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleAdd', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-add-'));
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    it('should create a memory and write success message to stdout', async () => {
        const capture = createCaptureStream();
        const ctx = createContext({
            adapter: createMockAdapter(),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/notes', { content: 'Hello world' });

        const out = capture.getOutput();
        expect(out).toContain('Added memory');
        expect(out).toContain('project/notes');
    });

    it('should pass tags from options', async () => {
        const capture = createCaptureStream();
        const ctx = createContext({
            adapter: createMockAdapter(),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/tagged', {
            content: 'Tagged memory',
            tags: ['foo', 'bar'],
        });

        expect(capture.getOutput()).toContain('Added memory');
        expect(capture.getOutput()).toContain('project/tagged');
    });

    it('should pass expiresAt from options', async () => {
        const capture = createCaptureStream();
        const ctx = createContext({
            adapter: createMockAdapter(),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/expiring', {
            content: 'Expires soon',
            expiresAt: '2030-12-31T00:00:00Z',
        });

        expect(capture.getOutput()).toContain('Added memory');
    });

    it('should pass citations from options', async () => {
        const capture = createCaptureStream();
        const ctx = createContext({
            adapter: createMockAdapter(),
            storePath: tempDir,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/cited', {
            content: 'Cited memory',
            citations: ['https://example.com/source'],
        });

        expect(capture.getOutput()).toContain('Added memory');
    });

    it('should throw CommanderError when store not found', async () => {
        const failingFactory = (() => undefined) as unknown as AdapterFactory;

        const stdin = new PassThrough();
        const ctx = createContext({
            adapter: createMockAdapter(),
            storePath: tempDir,
            stdin,
            adapterFactory: failingFactory,
        });

        await expect(
            handleAdd(ctx, 'nonexistent', 'project/notes', { content: 'test' })
        ).rejects.toThrow(CommanderError);
    });

    it('should throw InvalidArgumentError for MISSING_CONTENT when no content provided', async () => {
        const stdin = new PassThrough();
        stdin.end(); // EOF with no data → empty content → MISSING_CONTENT
        const ctx = createContext({
            adapter: createMockAdapter(),
            storePath: tempDir,
            stdin,
        });

        await expect(handleAdd(ctx, undefined, 'project/notes', {})).rejects.toThrow(
            InvalidArgumentError
        );
    });

    it('should throw CommanderError when memory create fails due to missing category', async () => {
        const ctx = createContext({
            adapter: createMockAdapter({
                categories: {
                    exists: async () => ok(false), // category absent → CATEGORY_NOT_FOUND
                },
            }),
            storePath: tempDir,
        });

        await expect(
            handleAdd(ctx, undefined, 'project/notes', { content: 'test' })
        ).rejects.toThrow(CommanderError);
    });

    it('should use stdin when no content option is provided', async () => {
        const stdin = new PassThrough();
        stdin.end('Content from stdin');
        const capture = createCaptureStream();
        const ctx = createContext({
            adapter: createMockAdapter(),
            storePath: tempDir,
            stdin,
            stdout: capture.stream,
        });

        await handleAdd(ctx, undefined, 'project/stdin', {});

        const out = capture.getOutput();
        expect(out).toContain('Added memory');
        expect(out).toContain('stdin');
    });
});
