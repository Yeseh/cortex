import { describe, it, expect } from 'bun:test';
import * as memoryIndex from './index.ts';

describe('memory/index barrel exports', () => {
    it('should export registerMemoryTools', () => {
        expect(typeof memoryIndex.registerMemoryTools).toBe('function');
    });

    it('should export addMemoryHandler', () => {
        expect(typeof memoryIndex.addMemoryHandler).toBe('function');
    });
    it('should export getMemoryHandler', () => {
        expect(typeof memoryIndex.getMemoryHandler).toBe('function');
    });
    it('should export updateMemoryHandler', () => {
        expect(typeof memoryIndex.updateMemoryHandler).toBe('function');
    });
    it('should export removeMemoryHandler', () => {
        expect(typeof memoryIndex.removeMemoryHandler).toBe('function');
    });
    it('should export moveMemoryHandler', () => {
        expect(typeof memoryIndex.moveMemoryHandler).toBe('function');
    });
    it('should export listMemoriesHandler', () => {
        expect(typeof memoryIndex.listMemoriesHandler).toBe('function');
    });
    it('should export pruneMemoriesHandler', () => {
        expect(typeof memoryIndex.pruneMemoriesHandler).toBe('function');
    });
    it('should export getRecentMemoriesHandler', () => {
        expect(typeof memoryIndex.getRecentMemoriesHandler).toBe('function');
    });

    it('should export addMemoryInputSchema', () => {
        expect(typeof memoryIndex.addMemoryInputSchema.safeParse).toBe('function');
    });
    it('should export getMemoryInputSchema', () => {
        expect(typeof memoryIndex.getMemoryInputSchema.safeParse).toBe('function');
    });
    it('should export updateMemoryInputSchema', () => {
        expect(typeof memoryIndex.updateMemoryInputSchema.safeParse).toBe('function');
    });
    it('should export removeMemoryInputSchema', () => {
        expect(typeof memoryIndex.removeMemoryInputSchema.safeParse).toBe('function');
    });
    it('should export moveMemoryInputSchema', () => {
        expect(typeof memoryIndex.moveMemoryInputSchema.safeParse).toBe('function');
    });
    it('should export listMemoriesInputSchema', () => {
        expect(typeof memoryIndex.listMemoriesInputSchema.safeParse).toBe('function');
    });
    it('should export pruneMemoriesInputSchema', () => {
        expect(typeof memoryIndex.pruneMemoriesInputSchema.safeParse).toBe('function');
    });
    it('should export getRecentMemoriesInputSchema', () => {
        expect(typeof memoryIndex.getRecentMemoriesInputSchema.safeParse).toBe('function');
    });
    it('should export reindexStoreHandler', () => {
        expect(typeof memoryIndex.reindexStoreHandler).toBe('function');
    });
    it('should export reindexStoreInputSchema', () => {
        expect(typeof memoryIndex.reindexStoreInputSchema.safeParse).toBe('function');
    });
});
