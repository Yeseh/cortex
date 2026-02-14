import { CategoryPath } from '@/category/category-path';
import { Slug } from '@/slug';
import { memoryError, type MemoryResult } from './result';
import { ok } from '@/result';

/** Parsed memory identity from a slug path */
export class MemoryPath {
    category: CategoryPath;
    slug: Slug;

    private constructor(category: CategoryPath, slug: Slug) {
        this.category = category;
        this.slug = slug;
    }

    static fromPath(path: string): MemoryResult<MemoryPath> {
        const segments = path.split('/').filter((s) => s.length > 0);
        if (segments.length < 2) {
            return memoryError('INVALID_PATH', 'Memory slug path must include at least two segments.');
        }
        
        return MemoryPath.fromSegments(...segments); 
    }

    static fromSegments(...segments: string[]): MemoryResult<MemoryPath> {
        if (segments.length < 2) {
            return memoryError('INVALID_PATH', 'Memory slug path must include at least two segments.');
        }

        const categorySegments = segments.slice(0, -1);
        const categoryResult = CategoryPath.fromSegments(categorySegments);
        if (!categoryResult.ok()) {
            return memoryError('INVALID_PATH', 'Invalid category path.', { 
                cause: categoryResult.error,
                path: segments.join('/'), 
            });
        }

        const rawSlug = segments[segments.length - 1]!; // we know this is not undefined due to the length check above
        const slugResult = Slug.from(rawSlug);
        if (!slugResult.ok()) {
            return memoryError('INVALID_SLUG', 'Invalid slug.', {
                path: rawSlug, 
                cause: slugResult.error,
            });
        }

        return ok(new MemoryPath(categoryResult.value, slugResult.value));
    }
};
