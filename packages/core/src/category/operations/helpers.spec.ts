/**
 * Unit tests for category path helper functions.
 *
 * @module core/category/operations/helpers.spec
 */

import { describe, expect, it } from 'bun:test';
import { isRootCategory, getParentPath, getAncestorPaths } from './helpers.ts';

describe('isRootCategory', () => {
    it('should return true for single segment paths', () => {
        expect(isRootCategory('project')).toBe(true);
        expect(isRootCategory('human')).toBe(true);
    });

    it('should return false for multi-segment paths', () => {
        expect(isRootCategory('project/cortex')).toBe(false);
        expect(isRootCategory('project/cortex/arch')).toBe(false);
    });
});

describe('getParentPath', () => {
    it('should return empty string for root categories', () => {
        expect(getParentPath('project')).toBe('');
    });

    it('should return parent path for nested categories', () => {
        expect(getParentPath('project/cortex')).toBe('project');
        expect(getParentPath('project/cortex/arch')).toBe('project/cortex');
    });
});

describe('getAncestorPaths', () => {
    it('should return empty array for root categories', () => {
        expect(getAncestorPaths('project')).toEqual([]);
    });

    it('should return empty array for direct children of root', () => {
        expect(getAncestorPaths('project/cortex')).toEqual([]);
    });

    it('should return ancestor paths for deeply nested', () => {
        expect(getAncestorPaths('project/cortex/arch')).toEqual(['project/cortex']);
        expect(getAncestorPaths('a/b/c/d')).toEqual(['a/b', 'a/b/c']);
    });
});
