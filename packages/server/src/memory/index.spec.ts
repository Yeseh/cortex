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
        expect(memoryIndex.addMemoryInputSchema).toBeDefined();
    });
    it('should export getMemoryInputSchema', () => {
        expect(memoryIndex.getMemoryInputSchema).toBeDefined();
    });
    it('should export updateMemoryInputSchema', () => {
        expect(memoryIndex.updateMemoryInputSchema).toBeDefined();
    });
    it('should export removeMemoryInputSchema', () => {
        expect(memoryIndex.removeMemoryInputSchema).toBeDefined();
    });
    it('should export moveMemoryInputSchema', () => {
        expect(memoryIndex.moveMemoryInputSchema).toBeDefined();
    });
    it('should export listMemoriesInputSchema', () => {
        expect(memoryIndex.listMemoriesInputSchema).toBeDefined();
    });
    it('should export pruneMemoriesInputSchema', () => {
        expect(memoryIndex.pruneMemoriesInputSchema).toBeDefined();
    });
    it('should export getRecentMemoriesInputSchema', () => {
        expect(memoryIndex.getRecentMemoriesInputSchema).toBeDefined();
    });
    it('should export reindexStoreHandler', () => {
        expect(typeof memoryIndex.reindexStoreHandler).toBe('function');
    });
    it('should export reindexStoreInputSchema', () => {
        expect(memoryIndex.reindexStoreInputSchema).toBeDefined();
    });
});
