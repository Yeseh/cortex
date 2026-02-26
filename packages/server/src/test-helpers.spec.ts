/**
 * Shared test helpers for the Cortex MCP server test suite.
 *
 * This file is intentionally named `.spec.ts` so Bun test discovers it,
 * but it contains NO `describe`/`it` blocks — only exported utilities and
 * mock factories consumed by other spec files.
 *
 * @module server/test-helpers
 */

import { mock } from 'bun:test';
import type { Mock } from 'bun:test';
import { ok, err } from '@yeseh/cortex-core';
import type { CortexContext, CortexSettings, ConfigStores } from '@yeseh/cortex-core';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { McpToolResponse } from './response.ts';

// =============================================================================
// 1. Result builders
// =============================================================================

/**
 * Wraps a value in an Ok result.
 *
 * @param value - The success value to wrap
 * @returns An Ok result
 */
export function okResult<T>(value: T) {
    return ok(value);
}

/**
 * Wraps an error in an Err result.
 *
 * @param error - The error value to wrap
 * @returns An Err result
 */
export function errResult<E>(error: E) {
    return err(error);
}

// =============================================================================
// 2. MCP response assertions
// =============================================================================

/**
 * Asserts that the provided async function throws an McpError with
 * `InvalidParams` error code. Optionally checks that the message
 * contains a given substring.
 *
 * @param fn - Async function expected to throw
 * @param messagePart - Optional substring the error message must contain
 *
 * @example
 * ```typescript
 * await expectMcpInvalidParams(() => handler(ctx, badInput));
 * await expectMcpInvalidParams(() => handler(ctx, badInput), 'store');
 * ```
 */
export async function expectMcpInvalidParams(
    fn: () => Promise<unknown>,
    messagePart?: string,
): Promise<void> {
    let threw = false;
    try {
        await fn();
    } catch (e) {
        threw = true;
        if (!(e instanceof McpError)) {
            throw new Error(`Expected McpError, got ${String(e)}`);
        }
        if (e.code !== ErrorCode.InvalidParams) {
            throw new Error(
                `Expected McpError with code InvalidParams (${ErrorCode.InvalidParams}), got ${e.code}`,
            );
        }
        if (messagePart !== undefined && !e.message.includes(messagePart)) {
            throw new Error(
                `Expected error message to contain "${messagePart}", got: "${e.message}"`,
            );
        }
    }
    if (!threw) {
        throw new Error('Expected function to throw McpError but it did not');
    }
}

/**
 * Asserts that the provided async function throws an McpError with
 * `InternalError` error code. Optionally checks that the message
 * contains a given substring.
 *
 * @param fn - Async function expected to throw
 * @param messagePart - Optional substring the error message must contain
 *
 * @example
 * ```typescript
 * await expectMcpInternalError(() => handler(ctx, input));
 * ```
 */
export async function expectMcpInternalError(
    fn: () => Promise<unknown>,
    messagePart?: string,
): Promise<void> {
    let threw = false;
    try {
        await fn();
    } catch (e) {
        threw = true;
        if (!(e instanceof McpError)) {
            throw new Error(`Expected McpError, got ${String(e)}`);
        }
        if (e.code !== ErrorCode.InternalError) {
            throw new Error(
                `Expected McpError with code InternalError (${ErrorCode.InternalError}), got ${e.code}`,
            );
        }
        if (messagePart !== undefined && !e.message.includes(messagePart)) {
            throw new Error(
                `Expected error message to contain "${messagePart}", got: "${e.message}"`,
            );
        }
    }
    if (!threw) {
        throw new Error('Expected function to throw McpError but it did not');
    }
}

/**
 * Asserts that the first content item of an MCP tool response contains
 * the provided text substring.
 *
 * @param response - The MCP tool response object
 * @param text - Text that must appear in `response.content[0].text`
 *
 * @example
 * ```typescript
 * const result = await addMemoryHandler(ctx, input);
 * expectTextResponseContains(result, 'Memory created');
 * ```
 */
export function expectTextResponseContains(
    response: McpToolResponse,
    text: string,
): void {
    const content = response.content[0];
    if (!content) {
        throw new Error('Response has no content items');
    }
    if (!content.text.includes(text)) {
        throw new Error(
            `Expected response text to contain "${text}", got: "${content.text}"`,
        );
    }
}

/**
 * Parses the first content item of an MCP tool response as JSON and
 * returns the resulting object.
 *
 * @param response - The MCP tool response object
 * @returns The parsed JSON value
 *
 * @example
 * ```typescript
 * const result = await getMemoryHandler(ctx, input);
 * const data = parseResponseJson(result);
 * expect(data.path).toBe('project/my-memory');
 * ```
 */
export function parseResponseJson(response: McpToolResponse): unknown {
    const content = response.content[0];
    if (!content) {
        throw new Error('Response has no content items');
    }
    return JSON.parse(content.text);
}

// =============================================================================
// 3. Mock context factories
// =============================================================================

/** Shared Memory metadata shape used by mock clients. */
type MockMemory = {
    path: string;
    content: string;
    metadata: {
        createdAt: Date;
        updatedAt: Date;
        tags: string[];
        source: string;
        citations: string[];
        expiresAt: Date | undefined;
    };
    isExpired: () => boolean;
};

/** Default mock Memory value returned by MemoryClient methods. */
const makeMockMemory = (): MockMemory => ({
    path: 'cat/slug',
    content: 'test',
    metadata: {
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        tags: [],
        source: 'mcp',
        citations: [],
        expiresAt: undefined,
    },
    isExpired: () => false,
});

/** Shape of the mock MemoryClient returned by `createMockMemoryClient`. */
export type MockMemoryClient = {
    create: Mock<() => Promise<ReturnType<typeof ok<MockMemory>>>>;
    get: Mock<() => Promise<ReturnType<typeof ok<MockMemory>>>>;
    update: Mock<() => Promise<ReturnType<typeof ok<MockMemory>>>>;
    delete: Mock<() => Promise<ReturnType<typeof ok<undefined>>>>;
    move: Mock<() => Promise<ReturnType<typeof ok<undefined>>>>;
};

/**
 * Creates a mock MemoryClient with spy functions.
 *
 * All methods return sensible defaults. Override individual methods by
 * passing an `overrides` object.
 *
 * @param overrides - Partial overrides for the mock client methods
 * @returns A mock object implementing the MemoryClient interface
 *
 * @example
 * ```typescript
 * const memClient = createMockMemoryClient({
 *     get: mock(async () => err({ code: 'MEMORY_NOT_FOUND', message: 'Not found' })),
 * });
 * ```
 */
export const createMockMemoryClient = (
    overrides: Partial<MockMemoryClient> = {},
): MockMemoryClient => {
    const defaults: MockMemoryClient = {
        create: mock(async () => ok(makeMockMemory())),
        get: mock(async () => ok(makeMockMemory())),
        update: mock(async () =>
            ok({ ...makeMockMemory(), content: 'updated' }),
        ),
        delete: mock(async () => ok(undefined)),
        move: mock(async () => ok(undefined)),
    };
    return { ...defaults, ...overrides };
};

/** Shape of the mock CategoryClient returned by `createMockCategoryClient`. */
export type MockCategoryClient = {
    rawPath: string;
    listMemories: Mock<() => Promise<ReturnType<typeof ok<unknown[]>>>>;
    listSubcategories: Mock<() => Promise<ReturnType<typeof ok<unknown[]>>>>;
    getMemory: Mock<() => MockMemoryClient>;
    getCategory: Mock<() => ReturnType<typeof ok<MockCategoryClient>>>;
    prune: Mock<
        () => Promise<ReturnType<typeof ok<{ pruned: unknown[]; dryRun: boolean }>>>
    >;
    reindex: Mock<
        () => Promise<ReturnType<typeof ok<{ warnings: unknown[] }>>>
    >;
};

/**
 * Creates a mock CategoryClient with spy functions.
 *
 * Default behavior:
 * - `listMemories` returns `ok([])`
 * - `listSubcategories` returns `ok([])`
 * - `getMemory` returns a fresh `createMockMemoryClient()`
 * - `getCategory` returns `ok` of another mock CategoryClient
 * - `prune` returns `ok({ pruned: [], dryRun: false })`
 * - `reindex` returns `ok({ warnings: [] })`
 *
 * @param overrides - Partial overrides for the mock client methods/properties
 * @returns A mock object implementing the CategoryClient interface
 */
export const createMockCategoryClient = (
    overrides: Partial<MockCategoryClient> = {},
): MockCategoryClient => {
    // Build a shallow nested mock for getCategory results
    const nestedCategory: MockCategoryClient = {
        rawPath: '/sub',
        listMemories: mock(async () => ok([])),
        listSubcategories: mock(async () => ok([])),
        getMemory: mock(() => createMockMemoryClient()),
        getCategory: mock(() => ok(nestedCategory)),
        prune: mock(async () => ok({ pruned: [], dryRun: false })),
        reindex: mock(async () => ok({ warnings: [] })),
    };

    const defaults: MockCategoryClient = {
        rawPath: '/',
        listMemories: mock(async () => ok([])),
        listSubcategories: mock(async () => ok([])),
        getMemory: mock(() => createMockMemoryClient()),
        getCategory: mock(() => ok(nestedCategory)),
        prune: mock(async () => ok({ pruned: [], dryRun: false })),
        reindex: mock(async () => ok({ warnings: [] })),
    };
    return { ...defaults, ...overrides };
};

/** Minimal StoreData-like shape for mock store load results. */
type MockStoreData = {
    kind: string;
    categoryMode: string;
    categories: unknown[];
    properties: Record<string, unknown>;
};

/** Shape of the mock StoreClient returned by `createMockStoreClient`. */
export type MockStoreClient = {
    name: string;
    adapter: Record<string, unknown>;
    data: null;
    getMemory: Mock<() => MockMemoryClient>;
    root: Mock<() => ReturnType<typeof ok<MockCategoryClient>>>;
    getCategory: Mock<() => ReturnType<typeof ok<MockCategoryClient>>>;
    initialize: Mock<() => Promise<ReturnType<typeof ok<undefined>>>>;
    load: Mock<() => Promise<ReturnType<typeof ok<MockStoreData>>>>;
};

/**
 * Creates a mock StoreClient with spy functions.
 *
 * Default behavior:
 * - `getMemory` returns a fresh `createMockMemoryClient()`
 * - `root` returns `ok(createMockCategoryClient())`
 * - `getCategory` returns `ok(createMockCategoryClient())`
 * - `initialize` returns `ok(undefined)`
 * - `load` returns `ok({ kind: 'filesystem', categoryMode: 'free', categories: [], properties: {} })`
 * - `adapter` is set to an empty object stub (used by get-recent-memories)
 *
 * @param overrides - Partial overrides for the mock client methods/properties
 * @returns A mock object implementing the StoreClient interface
 */
export const createMockStoreClient = (
    overrides: Partial<MockStoreClient> = {},
): MockStoreClient => {
    const defaults: MockStoreClient = {
        name: 'default',
        adapter: {},
        data: null,
        getMemory: mock(() => createMockMemoryClient()),
        root: mock(() => ok(createMockCategoryClient())),
        getCategory: mock(() => ok(createMockCategoryClient())),
        initialize: mock(async () => ok(undefined)),
        load: mock(async () =>
            ok({
                kind: 'filesystem',
                categoryMode: 'free',
                categories: [],
                properties: {},
            }),
        ),
    };
    return { ...defaults, ...overrides };
};

/** Shape of the mock Cortex object returned by `createMockCortex`. */
export type MockCortex = {
    getStore: Mock<(_name: string) => ReturnType<typeof ok<MockStoreClient>>>;
};

/**
 * Creates a mock Cortex-like object that duck-types the `Cortex` class.
 *
 * Default behavior:
 * - `getStore(name)` returns `ok(createMockStoreClient())`
 *
 * @param overrides - Partial overrides for the mock methods
 * @returns A mock object with a `getStore` method
 *
 * @example
 * ```typescript
 * const cortex = createMockCortex({
 *     getStore: mock(() => err({ code: 'STORE_NOT_FOUND', message: 'Not found' })),
 * });
 * ```
 */
export const createMockCortex = (
    overrides: Partial<MockCortex> = {},
): MockCortex => {
    const defaults: MockCortex = {
        getStore: mock((_name: string) => ok(createMockStoreClient())),
    };
    return { ...defaults, ...overrides };
};

/**
 * Creates a complete mock `CortexContext` for use in handler unit tests.
 *
 * Default values:
 * - `cortex` — result of `createMockCortex()`
 * - `stores` — `{}`
 * - `settings` — `{ defaultStore: 'default', outputFormat: 'json' }`
 * - `now` — `() => new Date()`
 * - `globalDataPath` — `/tmp/cortex-test`
 * - `stdin` / `stdout` — minimal stream stubs
 *
 * @param overrides - Partial overrides for the context properties
 * @returns A mock CortexContext ready for injection into handlers
 *
 * @example
 * ```typescript
 * const ctx = createMockCortexContext({
 *     cortex: createMockCortex({ getStore: mock(() => err(...)) }),
 * });
 * ```
 */
export const createMockCortexContext = (
    overrides: Partial<CortexContext> = {},
): CortexContext => {
    const defaultSettings: CortexSettings = {
        defaultStore: 'default',
        outputFormat: 'json',
    };

    const defaultStores: ConfigStores = {};

    // Minimal stream stubs that satisfy NodeJS.ReadStream / WriteStream
    const stdinStub = {
        readable: true,
        on: () => stdinStub,
        off: () => stdinStub,
        emit: () => false,
        pipe: () => stdinStub,
        read: () => null,
    } as unknown as NodeJS.ReadStream;

    const stdoutStub = {
        writable: true,
        write: () => true,
        on: () => stdoutStub,
        off: () => stdoutStub,
        emit: () => false,
    } as unknown as NodeJS.WriteStream;

    return {
        cortex: createMockCortex() as unknown as CortexContext['cortex'],
        settings: defaultSettings,
        stores: defaultStores,
        now: () => new Date(),
        globalDataPath: '/tmp/cortex-test',
        stdin: stdinStub,
        stdout: stdoutStub,
        ...overrides,
    };
};

// =============================================================================
// 4. Mock MCP server harness
// =============================================================================

/** Shape of a registered tool entry captured by `createMockMcpServer`. */
export type RegisteredTool = {
    description: string;
    schema: unknown;
    handler: (...args: unknown[]) => unknown;
};

/**
 * Creates a lightweight mock MCP server that captures all tool registrations.
 *
 * Supports both the `server.registerTool(name, opts, handler)` pattern and
 * the `server.tool(name, desc, schema, handler)` pattern.
 *
 * @returns An object with `registeredTools` Map and a `server` stub
 *
 * @example
 * ```typescript
 * const { registeredTools, server } = createMockMcpServer();
 * registerMemoryTools(server as unknown as McpServer, ctx);
 *
 * const tool = registeredTools.get('cortex_add_memory');
 * const result = await tool!.handler({ store: 'default', path: 'cat/mem', content: 'x' });
 * ```
 */
export const createMockMcpServer = () => {
    const registeredTools = new Map<string, RegisteredTool>();

    const server = {
        /**
         * Captures `server.registerTool(name, { description, inputSchema }, handler)`.
         */
        registerTool: (
            name: string,
            opts: { description?: string; inputSchema?: unknown },
            handler: (...args: unknown[]) => unknown,
        ) => {
            registeredTools.set(name, {
                description: opts.description ?? '',
                schema: opts.inputSchema ?? {},
                handler,
            });
        },

        /**
         * Captures `server.tool(name, description, schema, handler)`.
         */
        tool: (
            name: string,
            description: string,
            schema: unknown,
            handler: (...args: unknown[]) => unknown,
        ) => {
            registeredTools.set(name, {
                description,
                schema,
                handler,
            });
        },
    };

    return { registeredTools, server };
};

// =============================================================================
// 5. Environment helpers
// =============================================================================

/**
 * Temporarily overrides environment variables for the duration of `fn`,
 * then restores original values (or deletes keys that were absent before).
 *
 * @param overrides - Map of variable name → new value (pass `undefined` to delete)
 * @param fn - Async function to run with the overridden environment
 * @returns The return value of `fn`
 *
 * @example
 * ```typescript
 * const result = await withEnv(
 *     { CORTEX_DATA_PATH: '/tmp/test', HOME: undefined },
 *     async () => loadConfig(),
 * );
 * ```
 */
export async function withEnv<T>(
    overrides: Record<string, string | undefined>,
    fn: () => Promise<T>,
): Promise<T> {
    // Save current values (undefined means the key was absent)
    const saved: Record<string, string | undefined> = {};
    for (const key of Object.keys(overrides)) {
        saved[key] = process.env[key];
    }

    // Apply overrides
    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        return await fn();
    } finally {
        // Restore original values
        for (const [key, original] of Object.entries(saved)) {
            if (original === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = original;
            }
        }
    }
}
