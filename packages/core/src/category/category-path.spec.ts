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
});
