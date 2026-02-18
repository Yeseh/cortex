/**
 * Unit tests for the CategoryPath value object.
 *
 * @module core/category/category-path.spec
 */

import { describe, expect, it } from 'bun:test';
import { CategoryPath } from './category-path.ts';

describe('CategoryPath', () => {
    describe('fromString', () => {
        it('should parse valid category path', () => {
            const result = CategoryPath.fromString('project/cortex');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.toString()).toBe('project/cortex');
                expect(result.value.depth).toBe(2);
            }
        });

        it('should return root for empty string', () => {
            const result = CategoryPath.fromString('');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.isRoot).toBe(true);
                expect(result.value.toString()).toBe('');
                expect(result.value.depth).toBe(0);
            }
        });

        it('should return root for whitespace-only string', () => {
            const result = CategoryPath.fromString('   ');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.isRoot).toBe(true);
            }
        });

        it('should parse single segment path', () => {
            const result = CategoryPath.fromString('project');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.toString()).toBe('project');
                expect(result.value.depth).toBe(1);
            }
        });
    });

    describe('root', () => {
        it('should create root category', () => {
            const root = CategoryPath.root();

            expect(root.isRoot).toBe(true);
            expect(root.depth).toBe(0);
            expect(root.toString()).toBe('');
        });
    });

    describe('parent', () => {
        it('should return parent for nested path', () => {
            const result = CategoryPath.fromString('project/cortex/api');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                const parent = result.value.parent;
                expect(parent).not.toBeNull();
                expect(parent?.toString()).toBe('project/cortex');
            }
        });

        it('should return null for root', () => {
            const root = CategoryPath.root();
            expect(root.parent).toBeNull();
        });
    });

    describe('equals', () => {
        it('should compare equal paths', () => {
            const a = CategoryPath.fromString('project/cortex');
            const b = CategoryPath.fromString('project/cortex');

            expect(a.ok() && b.ok()).toBe(true);
            if (a.ok() && b.ok()) {
                expect(a.value.equals(b.value)).toBe(true);
            }
        });

        it('should compare root paths as equal', () => {
            const a = CategoryPath.root();
            const b = CategoryPath.fromString('');

            expect(b.ok()).toBe(true);
            if (b.ok()) {
                expect(a.equals(b.value)).toBe(true);
            }
        });
    });

    describe('isUnder', () => {
        it('should match everything when scope is root', () => {
            const root = CategoryPath.root();
            const standards = CategoryPath.fromString('standards');
            const nested = CategoryPath.fromString('standards/typescript/rules');

            expect(root.isUnder(root)).toBe(true);
            expect(standards.ok() && standards.value.isUnder(root)).toBe(true);
            expect(nested.ok() && nested.value.isUnder(root)).toBe(true);
        });

        it('should match itself for non-root scope', () => {
            const standardsResult = CategoryPath.fromString('standards');
            expect(standardsResult.ok()).toBe(true);
            if (standardsResult.ok()) {
                expect(standardsResult.value.isUnder(standardsResult.value)).toBe(true);
            }
        });

        it('should match descendants for non-root scope', () => {
            const standardsResult = CategoryPath.fromString('standards');
            const typescriptResult = CategoryPath.fromString('standards/typescript');
            const rulesResult = CategoryPath.fromString('standards/typescript/rules');

            expect(standardsResult.ok()).toBe(true);
            expect(typescriptResult.ok()).toBe(true);
            expect(rulesResult.ok()).toBe(true);

            if (standardsResult.ok() && typescriptResult.ok() && rulesResult.ok()) {
                expect(typescriptResult.value.isUnder(standardsResult.value)).toBe(true);
                expect(rulesResult.value.isUnder(standardsResult.value)).toBe(true);
            }
        });

        it('should NOT match unrelated paths', () => {
            const standardsResult = CategoryPath.fromString('standards');
            const humanResult = CategoryPath.fromString('human');
            const humanProfileResult = CategoryPath.fromString('human/profile');

            expect(standardsResult.ok()).toBe(true);
            expect(humanResult.ok()).toBe(true);
            expect(humanProfileResult.ok()).toBe(true);

            if (standardsResult.ok() && humanResult.ok() && humanProfileResult.ok()) {
                expect(humanResult.value.isUnder(standardsResult.value)).toBe(false);
                expect(humanProfileResult.value.isUnder(standardsResult.value)).toBe(false);
            }
        });

        it('should NOT match ancestors', () => {
            const standardsResult = CategoryPath.fromString('standards');
            const typescriptResult = CategoryPath.fromString('standards/typescript');

            expect(standardsResult.ok()).toBe(true);
            expect(typescriptResult.ok()).toBe(true);

            if (standardsResult.ok() && typescriptResult.ok()) {
                // standards is an ancestor of standards/typescript, not under it
                expect(standardsResult.value.isUnder(typescriptResult.value)).toBe(false);
            }
        });

        it('should return false when root path checks against non-root scope', () => {
            const root = CategoryPath.root();
            const standardsResult = CategoryPath.fromString('standards');
            
            expect(standardsResult.ok()).toBe(true);
            if (standardsResult.ok()) {
                expect(root.isUnder(standardsResult.value)).toBe(false);
            }
        });
    });
});
