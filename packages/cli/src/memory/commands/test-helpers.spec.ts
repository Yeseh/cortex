import { PassThrough } from 'node:stream';
import {
    Cortex,
    Memory,
    ok,
    type AdapterFactory,
    type ConfigAdapter,
    type ConfigStores,
    type CortexContext,
    type CortexSettings,
    type MemoryMetadata,
    type StorageAdapter,
} from '@yeseh/cortex-core';

export const createMockMemoryCommandAdapter = (
    overrides: Record<string, unknown> = {},
): StorageAdapter =>
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

export const createMemoryCommandContext = (options: {
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
        global: {
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

export const createCaptureStream = (): { stream: PassThrough; getOutput: () => string } => {
    let output = '';
    const stream = new PassThrough();
    const originalWrite = stream.write.bind(stream);
    stream.write = ((chunk: unknown, encoding?: unknown, cb?: unknown) => {
        output += Buffer.from(chunk as Buffer).toString(
            typeof encoding === 'string' ? (encoding as BufferEncoding) : undefined,
        );
        return originalWrite(chunk as Buffer, encoding as BufferEncoding, cb as () => void);
    }) as typeof stream.write;

    return { stream, getOutput: () => output };
};

export const createMemoryFixture = (
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