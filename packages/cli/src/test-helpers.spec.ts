/**
 * Shared test helpers for CLI package unit tests.
 *
 * Exports reusable primitives for result construction, stream capture,
 * clock fixtures, CLI error assertions, and mock adapter/context factories.
 * All other spec files in this package import from this module.
 *
 * @module cli/_test-helpers
 */

import { describe, expect, it } from 'bun:test';
import { PassThrough } from 'node:stream';
import { InvalidArgumentError, CommanderError } from '@commander-js/extra-typings';
import type {
    StorageAdapter,
    MemoryStorage,
    IndexStorage,
    CategoryStorage,
    ConfigStores,
    CortexContext,
} from '@yeseh/cortex-core';
import { testContext } from '@yeseh/cortex-core';

// ============================================================================
// 2.1 Result helpers
// ============================================================================

/**
 * Constructs a minimal ok-shaped result for use in mock return values.
 *
 * @param value - The success value
 * @returns A plain object compatible with ok result checks
 *
 * @example
 * ```typescript
 * const result = okResult('hello');
 * expect(result.ok()).toBe(true);
 * expect(result.value).toBe('hello');
 * ```
 */
export const okResult = <T>(value: T): { ok: () => true; value: T } => ({
    ok: () => true as const,
    value,
});

/**
 * Constructs a minimal err-shaped result for use in mock return values.
 *
 * @param error - The error value
 * @returns A plain object compatible with err result checks
 *
 * @example
 * ```typescript
 * const result = errResult({ code: 'NOT_FOUND', message: 'not found' });
 * expect(result.ok()).toBe(false);
 * ```
 */
export const errResult = <E>(error: E): { ok: () => false; error: E } => ({
    ok: () => false as const,
    error,
});

// ============================================================================
// 2.2 Stream and output helpers
// ============================================================================

/**
 * Creates a writable PassThrough stream and a helper to capture written text.
 *
 * @returns An object containing the stream and a `getOutput` function
 *
 * @example
 * ```typescript
 * const { stream, getOutput } = createWritableCapture();
 * stream.write('hello');
 * expect(getOutput()).toBe('hello');
 * ```
 */
export function createWritableCapture(): { stream: PassThrough; getOutput: () => string } {
    const stream = new PassThrough();
    let output = '';
    stream.on('data', (chunk: Buffer | string) => {
        output += chunk.toString();
    });
    return { stream, getOutput: () => output };
}

/**
 * Creates a readable PassThrough stream pre-loaded with text.
 *
 * @param text - The text to pre-load into the stream
 * @returns A PassThrough stream with the given text already written
 *
 * @example
 * ```typescript
 * const stream = createReadableFromText('user input\n');
 * ```
 */
export function createReadableFromText(text: string): PassThrough {
    const stream = new PassThrough();
    stream.end(text);
    return stream;
}

// ============================================================================
// 2.3 Clock helpers
// ============================================================================

/** ISO 8601 string for the fixed test clock date */
export const FIXED_NOW_ISO = '2025-06-01T12:00:00.000Z';

/** Fixed Date instance for use in tests */
export const FIXED_NOW = new Date(FIXED_NOW_ISO);

/**
 * Returns a `now` function that always returns the given ISO date.
 *
 * @param iso - ISO 8601 string (defaults to {@link FIXED_NOW_ISO})
 * @returns A zero-argument function returning the fixed Date
 *
 * @example
 * ```typescript
 * const ctx = createMockContext({ now: fixedNow('2025-01-01T00:00:00.000Z') });
 * ```
 */
export const fixedNow =
    (iso: string = FIXED_NOW_ISO): (() => Date) =>
    () =>
        new Date(iso);

// ============================================================================
// 2.4 CLI error assertion helpers
// ============================================================================

/**
 * Asserts that the given function throws an `InvalidArgumentError`.
 *
 * @param fn - Sync or async function expected to throw
 * @param messagePart - Optional substring the error message must contain
 *
 * @example
 * ```typescript
 * await expectInvalidArgumentError(
 *     () => parseMemoryPath(''),
 *     'must not be empty',
 * );
 * ```
 */
export async function expectInvalidArgumentError(
    fn: () => Promise<unknown> | unknown,
    messagePart?: string
): Promise<void> {
    let threw = false;
    try {
        await fn();
    } catch (e) {
        threw = true;
        expect(e).toBeInstanceOf(InvalidArgumentError);
        if (messagePart) {
            expect((e as Error).message).toContain(messagePart);
        }
    }
    if (!threw) {
        throw new Error('Expected InvalidArgumentError to be thrown but it was not');
    }
}

/**
 * Asserts that the given function throws a `CommanderError`.
 *
 * @param fn - Sync or async function expected to throw
 * @param codePart - Optional substring the error's `.code` must contain
 * @param messagePart - Optional substring the error message must contain
 *
 * @example
 * ```typescript
 * await expectCommanderError(
 *     () => handleAdd(ctx, args, 'missing-store'),
 *     'commander.storeNotFound',
 * );
 * ```
 */
export async function expectCommanderError(
    fn: () => Promise<unknown> | unknown,
    codePart?: string,
    messagePart?: string
): Promise<void> {
    let threw = false;
    try {
        await fn();
    } catch (e) {
        threw = true;
        expect(e).toBeInstanceOf(CommanderError);
        if (codePart) {
            expect((e as CommanderError).code).toContain(codePart);
        }
        if (messagePart) {
            expect((e as Error).message).toContain(messagePart);
        }
    }
    if (!threw) {
        throw new Error('Expected CommanderError to be thrown but it was not');
    }
}

// ============================================================================
// 2.5 Mock adapter factories
// ============================================================================

/**
 * Creates a minimal mock MemoryStorage with sensible defaults.
 *
 * @param overrides - Partial overrides for individual methods
 * @returns A fully-typed MemoryStorage mock
 *
 * @example
 * ```typescript
 * const memories = createMockMemoryStorage({
 *     load: async () => ok(sampleMemory),
 * });
 * ```
 */
export function createMockMemoryStorage(overrides: Partial<MemoryStorage> = {}): MemoryStorage {
    return {
        load: async () => ({
            ok: () => false as const,
            error: { code: 'MEMORY_NOT_FOUND', message: 'not found' },
        }),
        save: async () => ({ ok: () => true as const, value: undefined }),
        add: async () => ({ ok: () => true as const, value: undefined }),
        remove: async () => ({ ok: () => true as const, value: undefined }),
        move: async () => ({ ok: () => true as const, value: undefined }),
        ...overrides,
    } as unknown as MemoryStorage;
}

/**
 * Creates a minimal mock IndexStorage with sensible defaults.
 *
 * @param overrides - Partial overrides for individual methods
 * @returns A fully-typed IndexStorage mock
 *
 * @example
 * ```typescript
 * const indexes = createMockIndexStorage({
 *     load: async () => ok({ memories: [], subcategories: [] }),
 * });
 * ```
 */
export function createMockIndexStorage(overrides: Partial<IndexStorage> = {}): IndexStorage {
    return {
        load: async () => ({ ok: () => true as const, value: { memories: [], subcategories: [] } }),
        write: async () => ({ ok: () => true as const, value: undefined }),
        reindex: async () => ({ ok: () => true as const, value: { warnings: [] } }),
        updateAfterMemoryWrite: async () => ({ ok: () => true as const, value: undefined }),
        ...overrides,
    } as unknown as IndexStorage;
}

/**
 * Creates a minimal mock CategoryStorage with sensible defaults.
 *
 * @param overrides - Partial overrides for individual methods
 * @returns A fully-typed CategoryStorage mock
 *
 * @example
 * ```typescript
 * const categories = createMockCategoryStorage({
 *     exists: async () => ok(true),
 * });
 * ```
 */
export function createMockCategoryStorage(
    overrides: Partial<CategoryStorage> = {}
): CategoryStorage {
    return {
        exists: async () => ({ ok: () => true as const, value: false }),
        ensure: async () => ({ ok: () => true as const, value: undefined }),
        delete: async () => ({ ok: () => true as const, value: undefined }),
        setDescription: async () => ({ ok: () => true as const, value: undefined }),
        ...overrides,
    } as unknown as CategoryStorage;
}

/**
 * Creates a minimal mock StorageAdapter composed of mock sub-adapters.
 *
 * @param overrides - Partial overrides for individual sub-adapters
 * @returns A fully-typed StorageAdapter mock
 *
 * @example
 * ```typescript
 * const adapter = createMockStorageAdapter({
 *     memories: createMockMemoryStorage({ load: async () => ok(null) }),
 * });
 * ```
 */
export function createMockStorageAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
    return {
        memories: createMockMemoryStorage(),
        indexes: createMockIndexStorage(),
        categories: createMockCategoryStorage(),
        config: {
            path: '/tmp/cortex-test-config.yaml',
            data: null,
            stores: null,
            settings: null,
            initializeConfig: async () => ({ ok: () => true as const, value: undefined }),
            getSettings: async () => ({ ok: () => true as const, value: {} }),
            getStores: async () => ({ ok: () => true as const, value: {} }),
            getStore: async () => ({ ok: () => true as const, value: null }),
            saveStore: async () => ({ ok: () => true as const, value: undefined }),
        },
        ...overrides,
    } as unknown as StorageAdapter;
}

/** Options for {@link createMockContext} */
export interface MockContextOptions {
    /** Override the storage adapter (defaults to {@link createMockStorageAdapter}) */
    adapter?: StorageAdapter;
    /** Override the store configuration (defaults to a single in-memory mock store) */
    stores?: ConfigStores;
    /** Override the clock (defaults to {@link fixedNow}) */
    now?: () => Date;
    /** Override the current working directory */
    cwd?: string;
}

/** Result of {@link createMockContext} */
export interface MockContextResult {
    ctx: CortexContext;
    stdout: PassThrough;
    stdin: PassThrough;
}

/**
 * Creates a {@link CortexContext} backed by a real Cortex.init() with a mock adapter.
 *
 * @param overrides - Optional overrides for adapter, stores, clock, and cwd
 * @returns An object with the context and the raw stdout/stdin PassThrough streams
 *
 * @example
 * ```typescript
 * const { ctx, stdout } = createMockContext();
 * await handleAdd(ctx, args, 'global', {});
 * expect(captureOutput(stdout)).toContain('Memory added');
 * ```
 */
export function createMockContext(overrides?: MockContextOptions): MockContextResult {
    const stdout = new PassThrough();
    const stdin = new PassThrough();
    const adapter = overrides?.adapter ?? createMockStorageAdapter();
    const stores: ConfigStores = overrides?.stores ?? {
        global: {
            kind: 'filesystem',
            categoryMode: 'free',
            categories: {},
            properties: { path: '/mock/store' },
        },
    };

    const ctx = testContext({
        adapter,
        storePath: '/mock/store',
        stdout,
        stdin,
        stores,
        now: overrides?.now ?? fixedNow(),
    });

    if (overrides?.cwd) {
        (ctx as unknown as Record<string, unknown>).cwd = overrides.cwd;
    }

    return { ctx, stdout, stdin };
}

// ============================================================================
// 2.6 Output capture helper
// ============================================================================

/**
 * Reads all buffered output from a PassThrough stream synchronously.
 *
 * Drains already-buffered data without consuming future writes.
 * Useful for asserting output after a handler has finished writing.
 *
 * @param stream - The PassThrough stream to drain
 * @returns The concatenated string of all buffered chunks
 *
 * @example
 * ```typescript
 * const { ctx, stdout } = createMockContext();
 * await handleList(ctx, {}, 'global', {});
 * expect(captureOutput(stdout)).toContain('No memories found');
 * ```
 */
export function captureOutput(stream: PassThrough): string {
    const chunks: Buffer[] = [];
    let chunk: Buffer | null;
    while ((chunk = stream.read()) !== null) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString();
}

// ============================================================================
// Smoke test — validates all helpers are exported and callable
// ============================================================================

describe('test-helpers', () => {
    it('should export all helpers', () => {
        expect(typeof okResult).toBe('function');
        expect(typeof errResult).toBe('function');
        expect(typeof createWritableCapture).toBe('function');
        expect(typeof createReadableFromText).toBe('function');
        expect(typeof FIXED_NOW_ISO).toBe('string');
        expect(FIXED_NOW).toBeInstanceOf(Date);
        expect(typeof fixedNow).toBe('function');
        expect(typeof expectInvalidArgumentError).toBe('function');
        expect(typeof expectCommanderError).toBe('function');
        expect(typeof createMockMemoryStorage).toBe('function');
        expect(typeof createMockIndexStorage).toBe('function');
        expect(typeof createMockCategoryStorage).toBe('function');
        expect(typeof createMockStorageAdapter).toBe('function');
        expect(typeof createMockContext).toBe('function');
        expect(typeof captureOutput).toBe('function');
    });
});
