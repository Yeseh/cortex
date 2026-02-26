import { describe, it, expect, beforeEach } from 'bun:test';
import { registerMemoryTools } from './index.ts';
import { createMockMcpServer, createMockCortexContext, type RegisteredTool } from '../../test-helpers.spec.ts';

describe('registerMemoryTools', () => {
    let registeredTools: Map<string, RegisteredTool>;

    beforeEach(() => {
        const mock = createMockMcpServer();
        registerMemoryTools(mock.server as any, createMockCortexContext());
        registeredTools = mock.registeredTools;
    });

    it('should register cortex_add_memory', () => {
        expect(registeredTools.has('cortex_add_memory')).toBe(true);
    });

    it('should register cortex_get_memory', () => {
        expect(registeredTools.has('cortex_get_memory')).toBe(true);
    });

    it('should register cortex_update_memory', () => {
        expect(registeredTools.has('cortex_update_memory')).toBe(true);
    });

    it('should register cortex_remove_memory', () => {
        expect(registeredTools.has('cortex_remove_memory')).toBe(true);
    });

    it('should register cortex_move_memory', () => {
        expect(registeredTools.has('cortex_move_memory')).toBe(true);
    });

    it('should register cortex_list_memories', () => {
        expect(registeredTools.has('cortex_list_memories')).toBe(true);
    });

    it('should register cortex_prune_memories', () => {
        expect(registeredTools.has('cortex_prune_memories')).toBe(true);
    });

    it('should register cortex_reindex_store', () => {
        expect(registeredTools.has('cortex_reindex_store')).toBe(true);
    });

    it('should register cortex_get_recent_memories', () => {
        expect(registeredTools.has('cortex_get_recent_memories')).toBe(true);
    });

    it('should register exactly 9 memory tools', () => {
        expect(registeredTools.size).toBe(9);
    });

    it('should have a non-empty description for each registered tool', () => {
        for (const [, tool] of registeredTools) {
            expect(tool.description.length).toBeGreaterThan(0);
        }
    });
});
