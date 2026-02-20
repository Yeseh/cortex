/**
 * Tests for MemoryClient.
 *
 * @module core/cortex/memory-client.spec
 */

import { describe, expect, it } from 'bun:test';
import { MemoryClient } from './memory-client.ts';
import { Memory } from '@/memory/memory.ts';
import { ok } from '@/result.ts';
import { createMockStorageAdapter } from '@/test/mock-storage-adapter.ts';

const buildMemory = (path: string): Memory => {
    const now = new Date('2026-02-19T00:00:00.000Z');
    const memoryResult = Memory.init(
        path,
        {
            createdAt: now,
            updatedAt: now,
            tags: [],
            source: 'user',
            citations: [],
        },
        'sample content',
    );

    if (!memoryResult.ok()) {
        throw new Error(memoryResult.error.message);
    }

    return memoryResult.value;
};

describe('MemoryClient properties', () => {
    it('should normalize rawPath on create()', () => {
        const clientResult = MemoryClient.create('standards//typescript/style/', 'style', createMockStorageAdapter());

        expect(clientResult.path.toString()).toBe('standards/typescript/style');
        expect(clientResult.slug.toString()).toBe('style');
    });
});

describe('MemoryClient.parsePath()', () => {
    it('should parse a valid memory path', () => {
        const clientResult = MemoryClient.create('/standards/typescript/style', 'style', createMockStorageAdapter());
        const result = clientResult.parsePath();

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        
        expect(result.value.toString()).toBe('standards/typescript/style');
    });
});

describe('MemoryClient.parseSlug()', () => {
    it('should normalize valid slug values', () => {
        const clientResult = MemoryClient.create('/standards/typescript/my-style', 'My Style', createMockStorageAdapter());
        const result = clientResult.parseSlug();

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(result.value.toString()).toBe('my-style');
    });

    it('should return INVALID_PATH for empty slug', () => {
        const clientResult = MemoryClient.create('/standards/typescript/style', '', createMockStorageAdapter());
        const result = clientResult.parseSlug();

        expect(result.ok()).toBe(false);
        if (result.ok()) return;
        expect(result.error.code).toBe('INVALID_PATH');
    });
});

describe('MemoryClient.exists()', () => {
    it('should return true when memory file is present', async () => {
        const existingMemory = buildMemory('standards/typescript/style');
        let readPath = '';

        const adapter = createMockStorageAdapter({
            memories: {
                load: async (path) => {
                    readPath = path.toString();
                    return ok(existingMemory);
                },
            },
        });

        const clientResult = MemoryClient.create('/standards/typescript/style', 'style', adapter);
        const result = await clientResult.exists();

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(result.value).toBe(true);
        expect(readPath).toBe('standards/typescript/style');
    });

    it('should return false when memory file is absent', async () => {
        const clientResult = MemoryClient.create('/standards/typescript/missing', 'missing', createMockStorageAdapter());
        const result = await clientResult.exists();

        expect(result.ok()).toBe(true);
        if (!result.ok()) return;
        expect(result.value).toBe(false);
    });
});
