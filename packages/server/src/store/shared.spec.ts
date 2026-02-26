import { describe, expect, it } from 'bun:test';

import { convertToCategories, type CategoryInfo } from './shared.ts';

// CategoryDefinition is not exported from @yeseh/cortex-core, so we use a
// compatible plain-object shape for test fixtures.
type TestCategoryDef = {
    description?: string;
    subcategories?: Record<string, TestCategoryDef>;
};

describe('convertToCategories', () => {
    describe('empty / falsy input', () => {
        it('should return [] when given undefined', () => {
            const result = convertToCategories(undefined);

            expect(result).toEqual([]);
        });

        it('should return [] when given an empty object', () => {
            const result = convertToCategories({});

            expect(result).toEqual([]);
        });
    });

    describe('single flat category', () => {
        it('should return a single entry with path equal to the key', () => {
            const defs: Record<string, TestCategoryDef> = {
                foo: {},
            };

            const result = convertToCategories(defs);

            expect(result).toHaveLength(1);
            expect(result[0]?.path).toBe('foo');
        });

        it('should include an empty subcategories array when there are no children', () => {
            const defs: Record<string, TestCategoryDef> = {
                foo: {},
            };

            const result = convertToCategories(defs);

            expect(result[0]?.subcategories).toEqual([]);
        });

        it('should include the description field when a description is provided', () => {
            const defs: Record<string, TestCategoryDef> = {
                foo: { description: 'A test category' },
            };

            const result = convertToCategories(defs);

            expect(result[0]?.description).toBe('A test category');
        });

        it('should NOT include a description field when description is absent', () => {
            const defs: Record<string, TestCategoryDef> = {
                foo: {},
            };

            const result = convertToCategories(defs);

            // The property must be absent (not an empty string or null) so that
            // JSON serialisation omits it entirely.
            expect(result[0]?.description).toBeUndefined();
            expect(Object.prototype.hasOwnProperty.call(result[0], 'description')).toBe(false);
        });
    });

    describe('nested subcategories', () => {
        it('should place child inside parent.subcategories with a compound path', () => {
            const defs: Record<string, TestCategoryDef> = {
                parent: {
                    subcategories: {
                        child: {},
                    },
                },
            };

            const result = convertToCategories(defs);
            const parent = result[0] as CategoryInfo;

            expect(parent.path).toBe('parent');
            expect(parent.subcategories).toHaveLength(1);
            expect(parent.subcategories[0]?.path).toBe('parent/child');
        });

        it('should support three levels of nesting with correct paths', () => {
            const defs: Record<string, TestCategoryDef> = {
                a: {
                    subcategories: {
                        b: {
                            subcategories: {
                                c: {},
                            },
                        },
                    },
                },
            };

            const result = convertToCategories(defs);
            const a = result[0] as CategoryInfo;
            const b = a.subcategories[0] as CategoryInfo;
            const c = b.subcategories[0] as CategoryInfo;

            expect(a.path).toBe('a');
            expect(b.path).toBe('a/b');
            expect(c.path).toBe('a/b/c');
        });

        it('should attach an empty subcategories array to leaf nodes', () => {
            const defs: Record<string, TestCategoryDef> = {
                parent: {
                    subcategories: {
                        leaf: {},
                    },
                },
            };

            const result = convertToCategories(defs);
            const leaf = result[0]?.subcategories[0] as CategoryInfo;

            expect(leaf.subcategories).toEqual([]);
        });
    });

    describe('sorting', () => {
        it('should return categories sorted alphabetically by path', () => {
            const defs: Record<string, TestCategoryDef> = {
                zebra: {},
                apple: {},
                mango: {},
            };

            const result = convertToCategories(defs);

            expect(result.map((c) => c.path)).toEqual(['apple', 'mango', 'zebra']);
        });

        it('should sort a later-alphabet key after an earlier-alphabet key', () => {
            const defs: Record<string, TestCategoryDef> = {
                z: {},
                a: {},
            };

            const result = convertToCategories(defs);

            expect(result[0]?.path).toBe('a');
            expect(result[1]?.path).toBe('z');
        });
    });

    describe('prefix support', () => {
        it('should prepend the prefix to every path when provided', () => {
            const defs: Record<string, TestCategoryDef> = {
                name: {},
            };

            const result = convertToCategories(defs, 'prefix');

            expect(result[0]?.path).toBe('prefix/name');
        });

        it('should propagate the prefix through nested subcategories', () => {
            const defs: Record<string, TestCategoryDef> = {
                parent: {
                    subcategories: {
                        child: {},
                    },
                },
            };

            const result = convertToCategories(defs, 'root');
            const parent = result[0] as CategoryInfo;
            const child = parent.subcategories[0] as CategoryInfo;

            expect(parent.path).toBe('root/parent');
            expect(child.path).toBe('root/parent/child');
        });
    });

    describe('multiple top-level categories', () => {
        it('should return one entry per key in the definitions record', () => {
            const defs: Record<string, TestCategoryDef> = {
                standards: { description: 'Coding standards' },
                decisions: { description: 'Architecture decisions' },
                map: {},
            };

            const result = convertToCategories(defs);

            expect(result).toHaveLength(3);
        });

        it('should preserve descriptions for each category independently', () => {
            const defs: Record<string, TestCategoryDef> = {
                alpha: { description: 'First' },
                beta: { description: 'Second' },
            };

            const result = convertToCategories(defs);
            // sorted: alpha, beta
            expect(result[0]?.description).toBe('First');
            expect(result[1]?.description).toBe('Second');
        });
    });
});
