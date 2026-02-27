import { describe, expect, it } from 'bun:test';

import {
    configCategoriesToStoreCategories,
    storeCategoriesToConfigCategories,
} from './config.ts';
import { CategoryPath } from '../category/category-path.ts';

describe('config/store category conversions', () => {
    it('should convert config categories to store categories with self-contained paths', () => {
        const input = {
            standards: {
                description: 'Standards',
                subcategories: {
                    architecture: {
                        description: 'Architecture docs',
                    },
                },
            },
        };

        const result = configCategoriesToStoreCategories(input);
        expect(result.ok()).toBe(true);
        if (!result.ok()) return;

        const standards = result.value.find((category) => category.path.toString() === 'standards');
        expect(standards).toBeDefined();
        if (!standards) return;

        expect(standards.description).toBe('Standards');
        expect(standards.subcategories?.length).toBe(1);
        expect(standards.subcategories?.[0]?.path.toString()).toBe('standards/architecture');
        expect(standards.subcategories?.[0]?.description).toBe('Architecture docs');
    });

    it('should return validation error when config category path cannot form a valid CategoryPath', () => {
        const input = {
            Standards: {},
        };

        const result = configCategoriesToStoreCategories(input);
        expect(result.ok()).toBe(false);
        if (result.ok()) return;

        expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
        expect(result.error.field).toBe('Standards');
    });

    it('should convert store categories to config categories by stripping path', () => {
        const standardsPath = CategoryPath.fromString('standards');
        const architecturePath = CategoryPath.fromString('standards/architecture');
        expect(standardsPath.ok()).toBe(true);
        expect(architecturePath.ok()).toBe(true);
        if (!standardsPath.ok() || !architecturePath.ok()) return;

        const input = [{
            path: standardsPath.value,
            description: 'Standards',
            subcategories: [{
                path: architecturePath.value,
                description: 'Architecture docs',
            }],
        }];

        const result = storeCategoriesToConfigCategories(input);
        expect(result).toEqual({
            standards: {
                description: 'Standards',
                subcategories: {
                    architecture: {
                        description: 'Architecture docs',
                    },
                },
            },
        });
    });
});
