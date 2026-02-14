import { memoryError, type MemoryError } from '@/memory/result';
import { ok, type Result } from '@/result';
import { Slug } from '@/slug';

export class CategoryPath {
    #segments: Slug[];

    private constructor(segments: Slug[]) {
        this.#segments = segments;
    }

    static fromString(path: string): Result<CategoryPath, MemoryError> {
        const segments = path.split('/');

        return CategoryPath.fromSegments(segments);
    }

    static fromSegments(segments: string[]): Result<CategoryPath, MemoryError> {
        const slugSegments = segments 
            .map((s) => Slug.from(s))
            .filter((r) => r.ok())
            .map((r) => r.value);

        if (slugSegments.length === 0) {
            return memoryError('INVALID_PATH', 'Memory slug path must include at least one segment with valid slugs');
        }

        return ok(new CategoryPath(slugSegments));
    }

    get isRoot(): boolean {
        return this.#segments.length === 1;
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
            return this.#segments[0]!.toString();
        }
        return this.#segments.map((s) => s.toString()).join('/');
    }
};
