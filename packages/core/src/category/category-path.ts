import { memoryError, type MemoryError } from '@/memory/result';
import { ok, type Result } from '@/result';
import { Slug } from '@/slug';

export class CategoryPath {
    #segments: Slug[];

    private constructor(segments: Slug[]) {
        this.#segments = segments;
    }

    static root() : CategoryPath {
        return new CategoryPath([]);
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
};
