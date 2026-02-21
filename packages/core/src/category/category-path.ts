import { memoryError, type MemoryError } from '@/memory/result';
import { ok, type Result } from '@/result';
import { Slug } from '@/slug';

export class CategoryPath {
    #segments: Slug[];

    private constructor(segments: Slug[]) {
        this.#segments = segments;
    }

    static root(): CategoryPath {
        return new CategoryPath([]);
    }

    static fromString(path: string): Result<CategoryPath, MemoryError> {
        // Empty string or '/' represents the root category
        if (path.trim() === '' || path.trim() === '/') {
            return ok(CategoryPath.root());
        }

        const segments = path.split('/');

        return CategoryPath.fromSegments(segments);
    }

    static fromSegments(segments: string[]): Result<CategoryPath, MemoryError> {
        const slugSegments = segments
            .map((s) => Slug.from(s))
            .filter((r) => r.ok())
            .map((r) => r.value);

        if (slugSegments.length === 0) {
            return memoryError(
                'INVALID_PATH',
                'Category path must include at least one segment with valid slugs',
            );
        }

        return ok(new CategoryPath(slugSegments));
    }

    get isRoot(): boolean {
        return this.#segments.length === 0;
    }

    get root(): CategoryPath {
        return new CategoryPath(this.#segments.slice(0, 1));
    }

    get parent(): CategoryPath | null {
        if (this.isRoot) {
            return null;
        }
        return new CategoryPath(this.#segments.slice(0, -1));
    }

    get depth(): number {
        return this.#segments.length;
    }

    toString(): string {
        if (this.isRoot) {
            return '';
        }
        return this.#segments.map((s) => s.toString()).join('/');
    }

    equals(other: CategoryPath): boolean {
        if (this.depth !== other.depth) {
            return false;
        }

        if (this.isRoot && other.isRoot) {
            return true;
        }

        for (let i = 0; i < this.depth; i++) {
            if (!this.#segments[i]!.equals(other.#segments[i]!)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if this path is under or equal to the given scope.
     *
     * Root scope matches everything. For non-root scopes,
     * this path must either equal the scope or be a descendant.
     *
     * @module core/category
     * @param scope - The scope to check against
     * @returns true if this path is under or equal to scope, false otherwise
     *
     * @example
     * ```typescript
     * const standards = CategoryPath.fromString('standards').unwrap();
     * const typescript = CategoryPath.fromString('standards/typescript').unwrap();
     * const human = CategoryPath.fromString('human').unwrap();
     *
     * typescript.isChildOf(standards); // true
     * standards.isChildOf(standards);  // true
     * human.isChildOf(standards);      // false
     * standards.isChildOf(CategoryPath.root()); // true
     * ```
     *
     * @edgeCases
     * - Root scope always returns true
     * - Self-comparison returns true
     * - Ancestor paths return false (standards is NOT a child of standards/typescript)
     */
    isChildOf(scope: CategoryPath): boolean {
        // Root scope matches everything
        if (scope.isRoot) {
            return true;
        }

        // This path must have at least as many segments as scope
        if (this.#segments.length < scope.#segments.length) {
            return false;
        }

        // Check that this path starts with scope's segments
        for (let i = 0; i < scope.#segments.length; i++) {
            if (!this.#segments[i]!.equals(scope.#segments[i]!)) {
                return false;
            }
        }
        return true;
    }

    [Symbol.toPrimitive](hint: string): string {
        if (hint === 'string') {
            return this.toString();
        }
        return this.toString();
    }
}
