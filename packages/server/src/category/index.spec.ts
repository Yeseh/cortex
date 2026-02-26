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
        expect(categoryIndex.createCategoryInputSchema).toBeDefined();
    });
    it('should export setCategoryDescriptionInputSchema', () => {
        expect(categoryIndex.setCategoryDescriptionInputSchema).toBeDefined();
    });
    it('should export deleteCategoryInputSchema', () => {
        expect(categoryIndex.deleteCategoryInputSchema).toBeDefined();
    });
});
