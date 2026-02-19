/**
 * Tests for CategoryClient.
 *
 * @module core/cortex/category-client.spec
 */

import { describe, expect, it } from 'bun:test';
import { CategoryClient } from './category-client.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { ok } from '@/result.ts';

const createMockAdapter = (overrides?: Partial<{
    memories: Partial<ScopedStorageAdapter['memories']>;
    indexes: Partial<ScopedStorageAdapter['indexes']>;
    categories: Partial<ScopedStorageAdapter['categories']>;
}>): ScopedStorageAdapter => ({
    memories: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        remove: async () => ok(undefined),
        move: async () => ok(undefined),
        ...overrides?.memories,
    },
    indexes: {
        read: async () => ok(null),
        write: async () => ok(undefined),
        reindex: async () => ok({ warnings: [] }),
        updateAfterMemoryWrite: async () => ok(undefined),
        ...overrides?.indexes,
    },
    categories: {
        exists: async () => ok(false),
        ensure: async () => ok(undefined),
        delete: async () => ok(undefined),
        updateSubcategoryDescription: async () => ok(undefined),
        removeSubcategoryEntry: async () => ok(undefined),
        ...overrides?.categories,
    },
}) as ScopedStorageAdapter;

describe('CategoryClient.init()', () => {
    it('should create a client for root path', () => {
        const client = CategoryClient.init('/', createMockAdapter());

        expect(client.ok()).toBe(true);
        if (!client.ok()) return;
        expect(client.value.rawPath).toBe('/');
    });

    it('should normalize nested paths', () => {
        const client = CategoryClient.init('standards//typescript/', createMockAdapter());

        expect(client.ok()).toBe(true);
        if (!client.ok()) return;
        expect(client.value.rawPath).toBe('/standards/typescript');
    });

    it('should preserve normalized special-character paths', () => {
        const client = CategoryClient.init('!!!', createMockAdapter());

        expect(client.ok()).toBe(true);
        if (!client.ok()) return;
        expect(client.value.rawPath).toBe('/!!!');
    });
});

describe('CategoryClient.parsePath()', () => {
    it('should parse root as CategoryPath.root()', () => {
        const initResult = CategoryClient.init('/', createMockAdapter());
        expect(initResult.ok()).toBe(true);
        if (!initResult.ok()) return;

        const result = initResult.value.parsePath();

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(result.value.isRoot).toBe(true);
        expect(result.value.toString()).toBe('');
    });

    it('should parse non-root path segments', () => {
        const initResult = CategoryClient.init('/standards/typescript', createMockAdapter());
        expect(initResult.ok()).toBe(true);
        if (!initResult.ok()) return;

        const result = initResult.value.parsePath();

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(result.value.toString()).toBe('standards/typescript');
    });
});

describe('CategoryClient.getCategory()', () => {
    it('should return child category from root', () => {
        const rootResult = CategoryClient.init('/', createMockAdapter());
        expect(rootResult.ok()).toBe(true);
        if (!rootResult.ok()) return;

        const childResult = rootResult.value.getCategory('standards');

        expect(childResult.ok()).toBe(true);
        if (!childResult.ok()) return;
        expect(childResult.value.rawPath).toBe('/standards');
    });

    it('should return self for empty relative path', () => {
        const categoryResult = CategoryClient.init('/standards', createMockAdapter());
        expect(categoryResult.ok()).toBe(true);
        if (!categoryResult.ok()) return;

        const sameResult = categoryResult.value.getCategory('   ');

        expect(sameResult.ok()).toBe(true);
        if (!sameResult.ok()) return;
        expect(sameResult.value.rawPath).toBe('/standards');
    });
});

describe('CategoryClient.parent()', () => {
    it('should return null for root category', () => {
        const rootResult = CategoryClient.init('/', createMockAdapter());
        expect(rootResult.ok()).toBe(true);
        if (!rootResult.ok()) return;

        const parentResult = rootResult.value.parent();

        expect(parentResult.ok()).toBe(true);
        if (!parentResult.ok()) return;
        expect(parentResult.value).toBeNull();
    });

    it('should return immediate parent for nested category', () => {
        const categoryResult = CategoryClient.init('/standards/typescript', createMockAdapter());
        expect(categoryResult.ok()).toBe(true);
        if (!categoryResult.ok()) return;

        const parentResult = categoryResult.value.parent();

        expect(parentResult.ok()).toBe(true);
        if (!parentResult.ok()) return;
        expect(parentResult.value?.rawPath).toBe('/standards');
    });
});

describe('CategoryClient.exists()', () => {
    it('should return true when storage reports category exists', async () => {
        let calledPath = '';
        const adapter = createMockAdapter({
            categories: {
                exists: async (path) => {
                    calledPath = path.toString();
                    return ok(true);
                },
            },
        });

        const categoryResult = CategoryClient.init('/standards', adapter);
        expect(categoryResult.ok()).toBe(true);
        if (!categoryResult.ok()) return;

        const result = await categoryResult.value.exists();

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(result.value).toBe(true);
        expect(calledPath).toBe('standards');
    });
});
