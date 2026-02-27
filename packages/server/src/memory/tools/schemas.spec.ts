/**
 * Unit tests for memory tool input schemas.
 */

import { describe, expect, it } from 'bun:test';
import { addMemoryInputSchema } from './add-memory.ts';
import { getMemoryInputSchema } from './get-memory.ts';
import { updateMemoryInputSchema } from './update-memory.ts';
import { removeMemoryInputSchema } from './remove-memory.ts';
import { moveMemoryInputSchema } from './move-memory.ts';
import { listMemoriesInputSchema } from './list-memories.ts';
import { pruneMemoriesInputSchema } from './prune-memories.ts';
import { reindexStoreInputSchema } from './reindex-store.ts';
import { getRecentMemoriesInputSchema } from './get-recent-memories.ts';

describe('memory tool schemas reject missing store parameter', () => {
    it('should reject add_memory without store parameter', () => {
        const input = { path: 'project/test', content: 'test' };
        const result = addMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject get_memory without store parameter', () => {
        const input = { path: 'project/test' };
        const result = getMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject update_memory without store parameter', () => {
        const input = { path: 'project/test', content: 'updated' };
        const result = updateMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject remove_memory without store parameter', () => {
        const input = { path: 'project/test' };
        const result = removeMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject move_memory without store parameter', () => {
        const input = { from_path: 'project/source', to_path: 'project/dest' };
        const result = moveMemoryInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject list_memories without store parameter', () => {
        const input = { category: 'project' };
        const result = listMemoriesInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject prune_memories without store parameter', () => {
        const input = {};
        const result = pruneMemoriesInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should reject reindex_store without store parameter', () => {
        const input = {};
        const result = reindexStoreInputSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes('store'))).toBe(true);
        }
    });

    it('should accept valid input with store parameter', () => {
        const addInput = { store: 'global', path: 'project/test', content: 'test' };
        expect(addMemoryInputSchema.safeParse(addInput).success).toBe(true);

        const getInput = { store: 'global', path: 'project/test' };
        expect(getMemoryInputSchema.safeParse(getInput).success).toBe(true);

        const updateInput = { store: 'global', path: 'project/test', content: 'updated' };
        expect(updateMemoryInputSchema.safeParse(updateInput).success).toBe(true);

        const removeInput = { store: 'global', path: 'project/test' };
        expect(removeMemoryInputSchema.safeParse(removeInput).success).toBe(true);

        const moveInput = {
            store: 'global',
            from_path: 'project/source',
            to_path: 'project/dest',
        };
        expect(moveMemoryInputSchema.safeParse(moveInput).success).toBe(true);

        const listInput = { store: 'global', category: 'project' };
        expect(listMemoriesInputSchema.safeParse(listInput).success).toBe(true);

        const pruneInput = { store: 'global' };
        expect(pruneMemoriesInputSchema.safeParse(pruneInput).success).toBe(true);

        const reindexInput = { store: 'global' };
        expect(reindexStoreInputSchema.safeParse(reindexInput).success).toBe(true);

        const getRecentInput = { store: 'global' };
        expect(getRecentMemoriesInputSchema.safeParse(getRecentInput).success).toBe(true);
    });
});
