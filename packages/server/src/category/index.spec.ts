import { describe, it, expect } from 'bun:test';
import * as categoryIndex from './index.ts';

describe('category/index barrel exports', () => {
    it('should export registerCategoryTools', () => {
        expect(typeof categoryIndex.registerCategoryTools).toBe('function');
    });
    it('should export createCategoryHandler', () => {
        expect(typeof categoryIndex.createCategoryHandler).toBe('function');
    });
    it('should export setCategoryDescriptionHandler', () => {
        expect(typeof categoryIndex.setCategoryDescriptionHandler).toBe('function');
    });
    it('should export deleteCategoryHandler', () => {
        expect(typeof categoryIndex.deleteCategoryHandler).toBe('function');
    });
    it('should export createCategoryInputSchema', () => {
        expect(typeof categoryIndex.createCategoryInputSchema.safeParse).toBe('function');
    });
    it('should export setCategoryDescriptionInputSchema', () => {
        expect(typeof categoryIndex.setCategoryDescriptionInputSchema.safeParse).toBe('function');
    });
    it('should export deleteCategoryInputSchema', () => {
        expect(typeof categoryIndex.deleteCategoryInputSchema.safeParse).toBe('function');
    });
});
