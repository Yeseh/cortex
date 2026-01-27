# Add Category Descriptions Implementation Plan

**Goal:** Add optional descriptions to memory categories for better AI agent discoverability, with a new centralized category core module.
**Architecture:** Create `src/core/category/` module with pure business logic using a `CategoryStoragePort` interface, implement MCP tools in `src/server/category/`, and extend index types to support descriptions.
**Tech Stack:** TypeScript, Bun test framework, Zod validation, MCP SDK
**Session Id:** ses_3ff964546fferRVS8BT8tIdl5W

---

## Dependency Map

```
Section 2 (Index Types) ─────────────────────────────────┐
                                                         │
Section 1 (Core Module) ─── depends on ──> Section 2     │
                                                         ▼
Section 3 (Storage Port) ─── depends on ──> Section 1 + Section 2
                                                         │
                                                         ▼
Section 4 (MCP Tools) ─────── depends on ──> Section 1 + Section 3
                                                         │
                                                         ▼
Section 5 (List Update) ───── depends on ──> Section 2 + Section 4
                                                         │
                                                         ▼
Section 6 (Validation) ────── depends on ──> All above
```

**Parallelization Strategy:**

- Section 2 (Index Types) can start immediately (no dependencies)
- Section 1 (Core Module) can start in parallel with Section 2 for types definition
- Section 3 (Storage Port) must wait for Section 1 + 2
- Section 4 (MCP Tools) must wait for Section 1 + 3
- Section 5 + 6 can be parallelized after Section 4

---

## Section 2: Index Type Changes (START FIRST - No Dependencies)

### Task 2.1: Add description field to IndexSubcategoryEntry

**File:** `src/core/index/types.ts`

**Changes:**

```typescript
export interface IndexSubcategoryEntry {
    path: string;
    memoryCount: number;
    description?: string; // NEW: Max 500 chars
}
```

**Test:** Ensure existing code compiles (description is optional)

---

### Task 2.2: Update parser to handle description field

**File:** `src/core/index/parser.ts`

**Changes:**

1. Add `description` entry handler in `entryHandlers`:

```typescript
description: {
    section: 'subcategories',
    apply: (state, value) => {
        state.description = value.trim();
        return ok(undefined);
    },
},
```

2. Update `EntryState` interface:

```typescript
interface EntryState {
    path?: string;
    tokenEstimate?: number;
    summary?: string;
    memoryCount?: number;
    description?: string; // NEW
}
```

3. Update `finalizeEntry` for subcategories section:

```typescript
return ok({
    entry: {
        path: state.path,
        memoryCount: state.memoryCount,
        description: state.description, // NEW: only include if present
    },
    nextIndex,
});
```

4. Update `serializeSubcategoryEntry`:

```typescript
const serializeSubcategoryEntry = (entry: IndexSubcategoryEntry): IndexLineResult => {
    // ... existing validation ...
    const lines = [
        '  -',
        `    path: ${entry.path.trim()}`,
        `    memory_count: ${parsedCount.value}`,
    ];
    if (entry.description?.trim()) {
        lines.push(`    description: ${entry.description.trim()}`);
    }
    return ok(lines);
};
```

---

### Task 2.3: Write parser tests for description field

**File:** `src/core/index/parser.spec.ts`

**Add tests:**

```typescript
it('should parse subcategory with description', () => {
    const raw = [
        'memories: []',
        'subcategories:',
        '  - path: projects/cortex',
        '    memory_count: 5',
        '    description: Cortex memory system project knowledge',
    ].join('\n');
    const result = parseCategoryIndex(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
        expect(result.value.subcategories[0]?.description).toBe(
            'Cortex memory system project knowledge'
        );
    }
});

it('should serialize subcategory with description', () => {
    const index = {
        memories: [],
        subcategories: [{ path: 'projects/cortex', memoryCount: 5, description: 'Test desc' }],
    };
    const serialized = serializeCategoryIndex(index);
    expect(serialized.ok).toBe(true);
    if (serialized.ok) {
        expect(serialized.value).toContain('description: Test desc');
    }
});

it('should round-trip subcategory description', () => {
    const index = {
        memories: [],
        subcategories: [
            { path: 'projects/cortex', memoryCount: 5, description: 'Test description' },
        ],
    };
    const serialized = serializeCategoryIndex(index);
    expect(serialized.ok).toBe(true);
    if (serialized.ok) {
        const parsed = parseCategoryIndex(serialized.value);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.value.subcategories[0]?.description).toBe('Test description');
        }
    }
});
```

---

## Section 1: Core Category Module

### Task 1.1: Create category types

**File:** `src/core/category/types.ts` (NEW)

```typescript
/**
 * Category module types and storage port interface
 */

import type { Result } from '../types.ts';
import type { CategoryIndex } from '../index/types.ts';

/** Error codes for category operations */
export type CategoryErrorCode =
    | 'CATEGORY_NOT_FOUND'
    | 'ROOT_CATEGORY_REJECTED'
    | 'DESCRIPTION_TOO_LONG'
    | 'STORAGE_ERROR'
    | 'INVALID_PATH';

/** Error details for category operations */
export interface CategoryError {
    code: CategoryErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
}

/** Result of createCategory operation */
export interface CreateCategoryResult {
    path: string;
    created: boolean;
}

/** Result of setDescription operation */
export interface SetDescriptionResult {
    path: string;
    description: string | null;
}

/** Result of deleteCategory operation */
export interface DeleteCategoryResult {
    path: string;
    deleted: boolean;
}

/**
 * Abstract storage port for category operations.
 * Implementations provide actual storage access (filesystem, in-memory, etc.)
 */
export interface CategoryStoragePort {
    /** Check if a category exists */
    categoryExists(path: string): Promise<Result<boolean, CategoryError>>;

    /** Read a category index */
    readCategoryIndex(path: string): Promise<Result<CategoryIndex | null, CategoryError>>;

    /** Write a category index */
    writeCategoryIndex(path: string, index: CategoryIndex): Promise<Result<void, CategoryError>>;

    /** Ensure category directory exists (create if missing) */
    ensureCategoryDirectory(path: string): Promise<Result<void, CategoryError>>;

    /** Delete category directory recursively */
    deleteCategoryDirectory(path: string): Promise<Result<void, CategoryError>>;

    /** Update subcategory description in parent index */
    updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
        description: string | null
    ): Promise<Result<void, CategoryError>>;

    /** Remove subcategory entry from parent index */
    removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string
    ): Promise<Result<void, CategoryError>>;
}

/** Maximum description length in characters */
export const MAX_DESCRIPTION_LENGTH = 500;
```

---

### Task 1.2: Create category operations

**File:** `src/core/category/operations.ts` (NEW)

```typescript
/**
 * Pure category business logic operations
 */

import type { Result } from '../types.ts';
import { ok, err } from '../result.ts';
import type {
    CategoryStoragePort,
    CategoryError,
    CreateCategoryResult,
    SetDescriptionResult,
    DeleteCategoryResult,
} from './types.ts';
import { MAX_DESCRIPTION_LENGTH } from './types.ts';

/**
 * Check if a path is a root category (single segment)
 */
export const isRootCategory = (path: string): boolean => {
    const segments = path.split('/').filter((s) => s.length > 0);
    return segments.length === 1;
};

/**
 * Get parent path from a category path
 * Returns empty string for root categories
 */
export const getParentPath = (path: string): string => {
    const segments = path.split('/').filter((s) => s.length > 0);
    if (segments.length <= 1) {
        return '';
    }
    return segments.slice(0, -1).join('/');
};

/**
 * Get all ancestor paths for a category (excluding root)
 * Example: "a/b/c" -> ["a/b"]
 */
export const getAncestorPaths = (path: string): string[] => {
    const segments = path.split('/').filter((s) => s.length > 0);
    const ancestors: string[] = [];
    // Start from index 1 to skip root, stop before the path itself
    for (let i = 2; i < segments.length; i++) {
        ancestors.push(segments.slice(0, i).join('/'));
    }
    return ancestors;
};

/**
 * Create a category and its parent hierarchy (excluding root categories)
 */
export const createCategory = async (
    storage: CategoryStoragePort,
    path: string
): Promise<Result<CreateCategoryResult, CategoryError>> => {
    // Validate path
    const segments = path.split('/').filter((s) => s.length > 0);
    if (segments.length === 0) {
        return err({
            code: 'INVALID_PATH',
            message: 'Category path cannot be empty',
            path,
        });
    }

    // Check if already exists
    const existsResult = await storage.categoryExists(path);
    if (!existsResult.ok) {
        return existsResult;
    }
    if (existsResult.value) {
        return ok({ path, created: false });
    }

    // Create parent categories (excluding root)
    const ancestors = getAncestorPaths(path);
    for (const ancestor of ancestors) {
        const ancestorExists = await storage.categoryExists(ancestor);
        if (!ancestorExists.ok) {
            return ancestorExists;
        }
        if (!ancestorExists.value) {
            const ensureResult = await storage.ensureCategoryDirectory(ancestor);
            if (!ensureResult.ok) {
                return ensureResult;
            }
            // Initialize empty index
            const writeResult = await storage.writeCategoryIndex(ancestor, {
                memories: [],
                subcategories: [],
            });
            if (!writeResult.ok) {
                return writeResult;
            }
        }
    }

    // Create the target category
    const ensureResult = await storage.ensureCategoryDirectory(path);
    if (!ensureResult.ok) {
        return ensureResult;
    }

    // Initialize empty index
    const writeResult = await storage.writeCategoryIndex(path, {
        memories: [],
        subcategories: [],
    });
    if (!writeResult.ok) {
        return writeResult;
    }

    return ok({ path, created: true });
};

/**
 * Set or clear a category's description
 */
export const setDescription = async (
    storage: CategoryStoragePort,
    path: string,
    description: string
): Promise<Result<SetDescriptionResult, CategoryError>> => {
    // Reject root categories
    if (isRootCategory(path)) {
        return err({
            code: 'ROOT_CATEGORY_REJECTED',
            message: 'Cannot set description on root category',
            path,
        });
    }

    // Trim and validate length
    const trimmed = description.trim();
    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
        return err({
            code: 'DESCRIPTION_TOO_LONG',
            message: `Description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`,
            path,
        });
    }

    // Check category exists
    const existsResult = await storage.categoryExists(path);
    if (!existsResult.ok) {
        return existsResult;
    }
    if (!existsResult.value) {
        return err({
            code: 'CATEGORY_NOT_FOUND',
            message: `Category not found: ${path}`,
            path,
        });
    }

    // Update description in parent index
    const parentPath = getParentPath(path);
    const finalDescription = trimmed.length > 0 ? trimmed : null;

    const updateResult = await storage.updateSubcategoryDescription(
        parentPath,
        path,
        finalDescription
    );
    if (!updateResult.ok) {
        return updateResult;
    }

    return ok({ path, description: finalDescription });
};

/**
 * Delete a category and all its contents recursively
 */
export const deleteCategory = async (
    storage: CategoryStoragePort,
    path: string
): Promise<Result<DeleteCategoryResult, CategoryError>> => {
    // Reject root categories
    if (isRootCategory(path)) {
        return err({
            code: 'ROOT_CATEGORY_REJECTED',
            message: 'Cannot delete root category',
            path,
        });
    }

    // Check category exists
    const existsResult = await storage.categoryExists(path);
    if (!existsResult.ok) {
        return existsResult;
    }
    if (!existsResult.value) {
        return err({
            code: 'CATEGORY_NOT_FOUND',
            message: `Category not found: ${path}`,
            path,
        });
    }

    // Delete the category directory recursively
    const deleteResult = await storage.deleteCategoryDirectory(path);
    if (!deleteResult.ok) {
        return deleteResult;
    }

    // Remove from parent's subcategories list
    const parentPath = getParentPath(path);
    const removeResult = await storage.removeSubcategoryEntry(parentPath, path);
    if (!removeResult.ok) {
        return removeResult;
    }

    return ok({ path, deleted: true });
};
```

---

### Task 1.3: Create barrel export

**File:** `src/core/category/index.ts` (NEW)

```typescript
/**
 * Category module - centralized business logic for category operations
 *
 * @module core/category
 */

export type {
    CategoryErrorCode,
    CategoryError,
    CreateCategoryResult,
    SetDescriptionResult,
    DeleteCategoryResult,
    CategoryStoragePort,
} from './types.ts';

export { MAX_DESCRIPTION_LENGTH } from './types.ts';

export {
    isRootCategory,
    getParentPath,
    getAncestorPaths,
    createCategory,
    setDescription,
    deleteCategory,
} from './operations.ts';
```

---

### Task 1.4: Write unit tests for category operations

**File:** `src/core/category/operations.spec.ts` (NEW)

```typescript
/**
 * Unit tests for category operations using mock storage port
 */

import { describe, expect, it, beforeEach, mock } from 'bun:test';
import type { CategoryStoragePort, CategoryError } from './types.ts';
import type { CategoryIndex } from '../index/types.ts';
import type { Result } from '../types.ts';
import {
    isRootCategory,
    getParentPath,
    getAncestorPaths,
    createCategory,
    setDescription,
    deleteCategory,
} from './operations.ts';
import { MAX_DESCRIPTION_LENGTH } from './types.ts';

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Mock storage port factory
const createMockStorage = (overrides: Partial<CategoryStoragePort> = {}): CategoryStoragePort => ({
    categoryExists: mock(async () => ok(false)),
    readCategoryIndex: mock(async () => ok(null)),
    writeCategoryIndex: mock(async () => ok(undefined)),
    ensureCategoryDirectory: mock(async () => ok(undefined)),
    deleteCategoryDirectory: mock(async () => ok(undefined)),
    updateSubcategoryDescription: mock(async () => ok(undefined)),
    removeSubcategoryEntry: mock(async () => ok(undefined)),
    ...overrides,
});

describe('isRootCategory', () => {
    it('should return true for single segment paths', () => {
        expect(isRootCategory('project')).toBe(true);
        expect(isRootCategory('human')).toBe(true);
    });

    it('should return false for multi-segment paths', () => {
        expect(isRootCategory('project/cortex')).toBe(false);
        expect(isRootCategory('project/cortex/arch')).toBe(false);
    });
});

describe('getParentPath', () => {
    it('should return empty string for root categories', () => {
        expect(getParentPath('project')).toBe('');
    });

    it('should return parent path for nested categories', () => {
        expect(getParentPath('project/cortex')).toBe('project');
        expect(getParentPath('project/cortex/arch')).toBe('project/cortex');
    });
});

describe('getAncestorPaths', () => {
    it('should return empty array for root categories', () => {
        expect(getAncestorPaths('project')).toEqual([]);
    });

    it('should return empty array for direct children of root', () => {
        expect(getAncestorPaths('project/cortex')).toEqual([]);
    });

    it('should return ancestor paths for deeply nested', () => {
        expect(getAncestorPaths('project/cortex/arch')).toEqual(['project/cortex']);
        expect(getAncestorPaths('a/b/c/d')).toEqual(['a/b', 'a/b/c']);
    });
});

describe('createCategory', () => {
    it('should create a new category', async () => {
        const storage = createMockStorage();
        const result = await createCategory(storage, 'project/cortex');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.path).toBe('project/cortex');
            expect(result.value.created).toBe(true);
        }
    });

    it('should return created: false for existing category', async () => {
        const storage = createMockStorage({
            categoryExists: mock(async () => ok(true)),
        });
        const result = await createCategory(storage, 'project/cortex');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.created).toBe(false);
        }
    });

    it('should not create root categories in ancestors', async () => {
        const ensureCalls: string[] = [];
        const storage = createMockStorage({
            ensureCategoryDirectory: mock(async (path: string) => {
                ensureCalls.push(path);
                return ok(undefined);
            }),
        });

        await createCategory(storage, 'project/cortex/arch');

        // Should create project/cortex but not project (root)
        expect(ensureCalls).toContain('project/cortex');
        expect(ensureCalls).not.toContain('project');
    });
});

describe('setDescription', () => {
    it('should set description on existing category', async () => {
        const storage = createMockStorage({
            categoryExists: mock(async () => ok(true)),
        });

        const result = await setDescription(storage, 'project/cortex', 'Test description');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.description).toBe('Test description');
        }
    });

    it('should reject root categories', async () => {
        const storage = createMockStorage();
        const result = await setDescription(storage, 'project', 'Test');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('ROOT_CATEGORY_REJECTED');
        }
    });

    it('should reject descriptions over 500 characters', async () => {
        const storage = createMockStorage({
            categoryExists: mock(async () => ok(true)),
        });
        const longDesc = 'a'.repeat(501);

        const result = await setDescription(storage, 'project/cortex', longDesc);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('DESCRIPTION_TOO_LONG');
        }
    });

    it('should trim whitespace', async () => {
        let capturedDesc: string | null = null;
        const storage = createMockStorage({
            categoryExists: mock(async () => ok(true)),
            updateSubcategoryDescription: mock(async (_, __, desc) => {
                capturedDesc = desc;
                return ok(undefined);
            }),
        });

        await setDescription(storage, 'project/cortex', '  trimmed  ');

        expect(capturedDesc).toBe('trimmed');
    });

    it('should clear description with empty string', async () => {
        let capturedDesc: string | null = 'initial';
        const storage = createMockStorage({
            categoryExists: mock(async () => ok(true)),
            updateSubcategoryDescription: mock(async (_, __, desc) => {
                capturedDesc = desc;
                return ok(undefined);
            }),
        });

        await setDescription(storage, 'project/cortex', '');

        expect(capturedDesc).toBeNull();
    });

    it('should reject non-existent category', async () => {
        const storage = createMockStorage({
            categoryExists: mock(async () => ok(false)),
        });

        const result = await setDescription(storage, 'project/missing', 'Test');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
        }
    });
});

describe('deleteCategory', () => {
    it('should delete existing category', async () => {
        const storage = createMockStorage({
            categoryExists: mock(async () => ok(true)),
        });

        const result = await deleteCategory(storage, 'project/cortex');

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.deleted).toBe(true);
        }
    });

    it('should reject root categories', async () => {
        const storage = createMockStorage();
        const result = await deleteCategory(storage, 'project');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('ROOT_CATEGORY_REJECTED');
        }
    });

    it('should reject non-existent category', async () => {
        const storage = createMockStorage({
            categoryExists: mock(async () => ok(false)),
        });

        const result = await deleteCategory(storage, 'project/missing');

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('CATEGORY_NOT_FOUND');
        }
    });

    it('should remove entry from parent index', async () => {
        let removedPath: string | null = null;
        const storage = createMockStorage({
            categoryExists: mock(async () => ok(true)),
            removeSubcategoryEntry: mock(async (_, path) => {
                removedPath = path;
                return ok(undefined);
            }),
        });

        await deleteCategory(storage, 'project/cortex');

        expect(removedPath).toBe('project/cortex');
    });
});
```

---

## Section 3: Storage Port Implementation

### Task 3.1: Implement CategoryStoragePort in FilesystemStorageAdapter

**File:** `src/core/storage/filesystem.ts`

**Add new methods to FilesystemStorageAdapter:**

```typescript
// Add import
import type { CategoryStoragePort, CategoryError } from '../category/types.ts';

// Implement CategoryStoragePort interface
export class FilesystemStorageAdapter implements StorageAdapter, CategoryStoragePort {
    // ... existing code ...

    async categoryExists(path: string): Promise<Result<boolean, CategoryError>> {
        const dirPath = resolve(this.storeRoot, path);
        try {
            await access(dirPath);
            return ok(true);
        } catch {
            return ok(false);
        }
    }

    async ensureCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        const dirPath = resolve(this.storeRoot, path);
        try {
            await mkdir(dirPath, { recursive: true });
            return ok(undefined);
        } catch (error) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to create category directory: ${path}`,
                path,
                cause: error,
            });
        }
    }

    async deleteCategoryDirectory(path: string): Promise<Result<void, CategoryError>> {
        const dirPath = resolve(this.storeRoot, path);
        try {
            await rm(dirPath, { recursive: true });
            return ok(undefined);
        } catch (error) {
            if (isNotFoundError(error)) {
                return ok(undefined);
            }
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to delete category directory: ${path}`,
                path,
                cause: error,
            });
        }
    }

    async updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
        description: string | null
    ): Promise<Result<void, CategoryError>> {
        const indexName = parentPath === '' ? '' : parentPath;
        const currentIndex = await this.readCategoryIndex(indexName, { createWhenMissing: true });
        if (!currentIndex.ok) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to read parent index: ${parentPath}`,
                path: parentPath,
                cause: currentIndex.error,
            });
        }

        // Find or create subcategory entry
        const subcategories = currentIndex.value.subcategories;
        let entry = subcategories.find((s) => s.path === subcategoryPath);

        if (!entry) {
            entry = { path: subcategoryPath, memoryCount: 0 };
            subcategories.push(entry);
        }

        // Update description
        if (description === null) {
            delete entry.description;
        } else {
            entry.description = description;
        }

        // Sort and write back
        subcategories.sort((a, b) => a.path.localeCompare(b.path));
        const writeResult = await this.writeCategoryIndex(indexName, {
            memories: currentIndex.value.memories,
            subcategories,
        });

        if (!writeResult.ok) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to write parent index: ${parentPath}`,
                path: parentPath,
                cause: writeResult.error,
            });
        }

        return ok(undefined);
    }

    async removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string
    ): Promise<Result<void, CategoryError>> {
        const indexName = parentPath === '' ? '' : parentPath;
        const currentIndex = await this.readCategoryIndex(indexName, { createWhenMissing: false });
        if (!currentIndex.ok) {
            // Parent index doesn't exist, nothing to remove
            return ok(undefined);
        }

        const subcategories = currentIndex.value.subcategories.filter(
            (s) => s.path !== subcategoryPath
        );

        const writeResult = await this.writeCategoryIndex(indexName, {
            memories: currentIndex.value.memories,
            subcategories,
        });

        if (!writeResult.ok) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to update parent index: ${parentPath}`,
                path: parentPath,
                cause: writeResult.error,
            });
        }

        return ok(undefined);
    }

    // Adapter method for CategoryStoragePort.readCategoryIndex
    async readCategoryIndexForPort(
        path: string
    ): Promise<Result<CategoryIndex | null, CategoryError>> {
        const result = await this.readCategoryIndex(path, { createWhenMissing: false });
        if (!result.ok) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to read category index: ${path}`,
                path,
                cause: result.error,
            });
        }
        return ok(result.value);
    }

    // Adapter method for CategoryStoragePort.writeCategoryIndex
    async writeCategoryIndexForPort(
        path: string,
        index: CategoryIndex
    ): Promise<Result<void, CategoryError>> {
        const result = await this.writeCategoryIndex(path, index);
        if (!result.ok) {
            return err({
                code: 'STORAGE_ERROR',
                message: `Failed to write category index: ${path}`,
                path,
                cause: result.error,
            });
        }
        return ok(undefined);
    }
}
```

---

### Task 3.2: Write integration tests for storage port

**File:** `src/core/storage/filesystem.spec.ts`

**Add tests:**

```typescript
describe('CategoryStoragePort implementation', () => {
    // ... setup/teardown ...

    it('should check category existence', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Non-existent
        const result1 = await adapter.categoryExists('project/test');
        expect(result1.ok && result1.value).toBe(false);

        // Create and check
        await adapter.ensureCategoryDirectory('project/test');
        const result2 = await adapter.categoryExists('project/test');
        expect(result2.ok && result2.value).toBe(true);
    });

    it('should update subcategory description', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Ensure parent exists
        await adapter.ensureCategoryDirectory('project');
        await adapter.writeCategoryIndex('project', {
            memories: [],
            subcategories: [{ path: 'project/test', memoryCount: 0 }],
        });

        // Update description
        await adapter.updateSubcategoryDescription('project', 'project/test', 'Test description');

        // Verify
        const index = await adapter.readCategoryIndex('project');
        expect(index.ok).toBe(true);
        if (index.ok && index.value) {
            expect(index.value.subcategories[0]?.description).toBe('Test description');
        }
    });

    it('should clear description with null', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Setup with description
        await adapter.ensureCategoryDirectory('project');
        await adapter.writeCategoryIndex('project', {
            memories: [],
            subcategories: [{ path: 'project/test', memoryCount: 0, description: 'Old desc' }],
        });

        // Clear
        await adapter.updateSubcategoryDescription('project', 'project/test', null);

        // Verify
        const index = await adapter.readCategoryIndex('project');
        expect(index.ok).toBe(true);
        if (index.ok && index.value) {
            expect(index.value.subcategories[0]?.description).toBeUndefined();
        }
    });

    it('should delete category directory recursively', async () => {
        const adapter = new FilesystemStorageAdapter({ rootDirectory: tempDir });

        // Create nested structure
        await adapter.ensureCategoryDirectory('project/test/nested');
        await adapter.writeCategoryIndex('project/test/nested', {
            memories: [],
            subcategories: [],
        });

        // Delete parent
        await adapter.deleteCategoryDirectory('project/test');

        // Verify gone
        const exists = await adapter.categoryExists('project/test');
        expect(exists.ok && exists.value).toBe(false);
    });
});
```

---

## Section 4: MCP Category Tools

### Task 4.1: Create category tools module

**File:** `src/server/category/tools.ts` (NEW)

```typescript
/**
 * MCP category tools for managing memory categories.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Result } from '../../core/types.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem.ts';
import {
    createCategory,
    setDescription,
    deleteCategory,
    MAX_DESCRIPTION_LENGTH,
} from '../../core/category/index.ts';
import type { ServerConfig } from '../config.ts';
import { getMemoryPath } from '../config.ts';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const storeNameSchema = z.string().optional();
const categoryPathSchema = z.string().min(1, 'Category path is required');

export const createCategoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (uses default if omitted)'),
    path: categoryPathSchema.describe('Category path (e.g., "project/cortex")'),
});

export const setCategoryDescriptionInputSchema = z.object({
    store: storeNameSchema.describe('Store name (uses default if omitted)'),
    path: categoryPathSchema.describe('Category path (e.g., "project/cortex")'),
    description: z
        .string()
        .max(
            MAX_DESCRIPTION_LENGTH,
            `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
        )
        .describe('Category description (empty string to clear)'),
});

export const deleteCategoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (uses default if omitted)'),
    path: categoryPathSchema.describe('Category path to delete'),
});

// ---------------------------------------------------------------------------
// Input Types
// ---------------------------------------------------------------------------

export interface CreateCategoryInput {
    store?: string;
    path: string;
}

export interface SetCategoryDescriptionInput {
    store?: string;
    path: string;
    description: string;
}

export interface DeleteCategoryInput {
    store?: string;
    path: string;
}

interface ToolContext {
    config: ServerConfig;
}

interface McpToolResponse {
    [key: string]: unknown;
    content: { type: 'text'; text: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const resolveStoreRoot = async (
    config: ServerConfig,
    storeName: string | undefined,
    autoCreate: boolean
): Promise<Result<string, McpError>> => {
    const store = storeName ?? config.defaultStore;
    const memoryPath = getMemoryPath(config);
    const storeRoot = resolve(memoryPath, store);

    if (autoCreate) {
        try {
            await mkdir(storeRoot, { recursive: true });
        } catch {
            return err(
                new McpError(ErrorCode.InternalError, `Failed to create store directory: ${store}`)
            );
        }
    }

    return ok(storeRoot);
};

const createAdapter = (storeRoot: string): FilesystemStorageAdapter => {
    return new FilesystemStorageAdapter({ rootDirectory: storeRoot });
};

const parseInput = <T>(schema: z.ZodSchema<T>, input: unknown): T => {
    const result = schema.safeParse(input);
    if (!result.success) {
        const message = result.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        throw new McpError(ErrorCode.InvalidParams, message);
    }
    return result.data;
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const createCategoryHandler = async (
    ctx: ToolContext,
    input: CreateCategoryInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, true);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const adapter = createAdapter(storeRoot.value);
    const result = await createCategory(adapter, input.path);

    if (!result.ok) {
        if (result.error.code === 'INVALID_PATH') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    path: result.value.path,
                    created: result.value.created,
                }),
            },
        ],
    };
};

export const setCategoryDescriptionHandler = async (
    ctx: ToolContext,
    input: SetCategoryDescriptionInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, true);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const adapter = createAdapter(storeRoot.value);

    // MCP convenience: auto-create category if it doesn't exist
    const createResult = await createCategory(adapter, input.path);
    if (!createResult.ok && createResult.error.code !== 'INVALID_PATH') {
        throw new McpError(ErrorCode.InternalError, createResult.error.message);
    }

    const result = await setDescription(adapter, input.path, input.description);

    if (!result.ok) {
        if (result.error.code === 'ROOT_CATEGORY_REJECTED') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'DESCRIPTION_TOO_LONG') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'CATEGORY_NOT_FOUND') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    path: result.value.path,
                    description: result.value.description,
                }),
            },
        ],
    };
};

export const deleteCategoryHandler = async (
    ctx: ToolContext,
    input: DeleteCategoryInput
): Promise<McpToolResponse> => {
    const storeRoot = await resolveStoreRoot(ctx.config, input.store, false);
    if (!storeRoot.ok) {
        throw storeRoot.error;
    }

    const adapter = createAdapter(storeRoot.value);
    const result = await deleteCategory(adapter, input.path);

    if (!result.ok) {
        if (result.error.code === 'ROOT_CATEGORY_REJECTED') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        if (result.error.code === 'CATEGORY_NOT_FOUND') {
            throw new McpError(ErrorCode.InvalidParams, result.error.message);
        }
        throw new McpError(ErrorCode.InternalError, result.error.message);
    }

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    path: result.value.path,
                    deleted: result.value.deleted,
                }),
            },
        ],
    };
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const registerCategoryTools = (server: McpServer, config: ServerConfig): void => {
    const ctx: ToolContext = { config };

    server.tool(
        'cortex_create_category',
        'Create a category and its parent hierarchy',
        createCategoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(createCategoryInputSchema, input);
            return createCategoryHandler(ctx, parsed);
        }
    );

    server.tool(
        'cortex_set_category_description',
        'Set or clear a category description (auto-creates category)',
        setCategoryDescriptionInputSchema.shape,
        async (input) => {
            const parsed = parseInput(setCategoryDescriptionInputSchema, input);
            return setCategoryDescriptionHandler(ctx, parsed);
        }
    );

    server.tool(
        'cortex_delete_category',
        'Delete a category and all its contents recursively',
        deleteCategoryInputSchema.shape,
        async (input) => {
            const parsed = parseInput(deleteCategoryInputSchema, input);
            return deleteCategoryHandler(ctx, parsed);
        }
    );
};
```

---

### Task 4.2: Create barrel export and register tools

**File:** `src/server/category/index.ts` (NEW)

```typescript
/**
 * MCP category tools module
 */

export {
    registerCategoryTools,
    createCategoryInputSchema,
    setCategoryDescriptionInputSchema,
    deleteCategoryInputSchema,
    type CreateCategoryInput,
    type SetCategoryDescriptionInput,
    type DeleteCategoryInput,
    createCategoryHandler,
    setCategoryDescriptionHandler,
    deleteCategoryHandler,
} from './tools.ts';
```

---

### Task 4.3: Register tools in MCP server

**File:** `src/server/index.ts`

Add import and registration:

```typescript
import { registerCategoryTools } from './category/index.ts';

// In server setup function:
registerCategoryTools(server, config);
```

---

### Task 4.4: Write MCP tool tests

**File:** `src/server/category/tools.spec.ts` (NEW)

```typescript
/**
 * Unit tests for MCP category tools.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ServerConfig } from '../config.ts';
import {
    createCategoryHandler,
    setCategoryDescriptionHandler,
    deleteCategoryHandler,
    type CreateCategoryInput,
    type SetCategoryDescriptionInput,
    type DeleteCategoryInput,
} from './tools.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem.ts';
import { parseCategoryIndex } from '../../core/index/parser.ts';

const createTestConfig = (dataPath: string): ServerConfig => ({
    dataPath,
    port: 3000,
    host: '127.0.0.1',
    defaultStore: 'default',
    logLevel: 'info',
    outputFormat: 'yaml',
    autoSummaryThreshold: 500,
});

const createTestDir = async (): Promise<string> => {
    const testDir = join(
        tmpdir(),
        `cortex-cat-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
    return testDir;
};

describe('cortex_create_category tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should create a new category', async () => {
        const input: CreateCategoryInput = {
            path: 'project/cortex',
        };

        const result = await createCategoryHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.path).toBe('project/cortex');
        expect(output.created).toBe(true);
    });

    it('should return created: false for existing category', async () => {
        const input: CreateCategoryInput = { path: 'project/cortex' };

        // Create first time
        await createCategoryHandler({ config }, input);

        // Create again
        const result = await createCategoryHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.created).toBe(false);
    });
});

describe('cortex_set_category_description tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should set description and auto-create category', async () => {
        const input: SetCategoryDescriptionInput = {
            path: 'project/cortex',
            description: 'Cortex memory system',
        };

        const result = await setCategoryDescriptionHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.description).toBe('Cortex memory system');
    });

    it('should reject root category', async () => {
        const input: SetCategoryDescriptionInput = {
            path: 'project',
            description: 'Test',
        };

        await expect(setCategoryDescriptionHandler({ config }, input)).rejects.toThrow(
            'root category'
        );
    });

    it('should reject description over 500 chars', async () => {
        const input: SetCategoryDescriptionInput = {
            path: 'project/cortex',
            description: 'a'.repeat(501),
        };

        await expect(setCategoryDescriptionHandler({ config }, input)).rejects.toThrow();
    });

    it('should clear description with empty string', async () => {
        // First set a description
        await setCategoryDescriptionHandler(
            { config },
            {
                path: 'project/cortex',
                description: 'Initial',
            }
        );

        // Then clear it
        const result = await setCategoryDescriptionHandler(
            { config },
            {
                path: 'project/cortex',
                description: '',
            }
        );
        const output = JSON.parse(result.content[0]!.text);

        expect(output.description).toBeNull();
    });
});

describe('cortex_delete_category tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        // Create a category to delete
        await createCategoryHandler({ config }, { path: 'project/deleteme' });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should delete existing category', async () => {
        const input: DeleteCategoryInput = {
            path: 'project/deleteme',
        };

        const result = await deleteCategoryHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.deleted).toBe(true);
    });

    it('should reject root category deletion', async () => {
        const input: DeleteCategoryInput = {
            path: 'project',
        };

        await expect(deleteCategoryHandler({ config }, input)).rejects.toThrow('root category');
    });

    it('should reject non-existent category', async () => {
        const input: DeleteCategoryInput = {
            path: 'project/nonexistent',
        };

        await expect(deleteCategoryHandler({ config }, input)).rejects.toThrow('not found');
    });
});
```

---

## Section 5: List Memories Update

### Task 5.1: Update list_memories to include description

**File:** `src/server/memory/tools.ts`

Update the `listMemoriesHandler` to include subcategory descriptions in response:

```typescript
// In listMemoriesHandler, update the output type and collection logic:

interface SubcategoryEntry {
    path: string;
    memory_count: number;
    description?: string;
}

// After collecting memories, also collect subcategories with descriptions:
const subcategories: SubcategoryEntry[] = [];

// In the collectMemories function or separate logic:
if (categoryPath) {
    const indexResult = await adapter.readIndexFile(categoryPath);
    if (indexResult.ok && indexResult.value) {
        const parsed = parseCategoryIndex(indexResult.value);
        if (parsed.ok) {
            for (const sub of parsed.value.subcategories) {
                subcategories.push({
                    path: sub.path,
                    memory_count: sub.memoryCount,
                    description: sub.description,
                });
            }
        }
    }
}

// Update output to include subcategories:
const output = {
    category: categoryPath || 'all',
    count: memories.length,
    memories,
    subcategories, // NEW
};
```

---

### Task 5.2: Write tests for list_memories with descriptions

**File:** `src/server/memory/tools.spec.ts`

Add test:

```typescript
it('should include subcategory descriptions in list response', async () => {
    const storeRoot = join(testDir, 'default');

    // Create category with description using the category tools
    const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
    await adapter.ensureCategoryDirectory('project/subcategory');
    await adapter.writeCategoryIndex('project', {
        memories: [],
        subcategories: [
            {
                path: 'project/subcategory',
                memoryCount: 0,
                description: 'Test subcategory description',
            },
        ],
    });
    await adapter.writeCategoryIndex('project/subcategory', {
        memories: [],
        subcategories: [],
    });

    const input: ListMemoriesInput = {
        category: 'project',
    };

    const result = await listMemoriesHandler({ config }, input);
    const output = JSON.parse(result.content[0]!.text);

    expect(output.subcategories).toBeDefined();
    expect(output.subcategories[0]?.description).toBe('Test subcategory description');
});
```

---

## Section 6: Validation Tests

These are end-to-end validation tests to ensure all requirements are met.

### Task 6.1-6.5: Add validation tests

**File:** `src/server/category/validation.spec.ts` (NEW)

```typescript
/**
 * End-to-end validation tests for category descriptions feature
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ServerConfig } from '../config.ts';
import {
    createCategoryHandler,
    setCategoryDescriptionHandler,
    deleteCategoryHandler,
} from './tools.ts';
import { listMemoriesHandler, addMemoryHandler, removeMemoryHandler } from '../memory/tools.ts';
import { FilesystemStorageAdapter } from '../../core/storage/filesystem.ts';
import { parseCategoryIndex } from '../../core/index/parser.ts';

const createTestConfig = (dataPath: string): ServerConfig => ({
    dataPath,
    port: 3000,
    host: '127.0.0.1',
    defaultStore: 'default',
    logLevel: 'info',
    outputFormat: 'yaml',
    autoSummaryThreshold: 500,
});

const createTestDir = async (): Promise<string> => {
    const testDir = join(
        tmpdir(),
        `cortex-validation-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
    return testDir;
};

describe('Category descriptions validation', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should reject setDescription on root categories', async () => {
        await expect(
            setCategoryDescriptionHandler(
                { config },
                {
                    path: 'project',
                    description: 'Test',
                }
            )
        ).rejects.toThrow();
    });

    it('should reject deleteCategory on root categories', async () => {
        await expect(
            deleteCategoryHandler(
                { config },
                {
                    path: 'project',
                }
            )
        ).rejects.toThrow();
    });

    it('should persist description after all memories deleted', async () => {
        // Create category with description
        await setCategoryDescriptionHandler(
            { config },
            {
                path: 'project/test',
                description: 'Test description',
            }
        );

        // Add a memory
        await addMemoryHandler(
            { config },
            {
                path: 'project/test/memory1',
                content: 'Test content',
            }
        );

        // Remove the memory
        await removeMemoryHandler(
            { config },
            {
                path: 'project/test/memory1',
            }
        );

        // Verify description persists
        const storeRoot = join(testDir, 'default');
        const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
        const indexResult = await adapter.readIndexFile('project');

        expect(indexResult.ok).toBe(true);
        if (indexResult.ok && indexResult.value) {
            const parsed = parseCategoryIndex(indexResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                const entry = parsed.value.subcategories.find((s) => s.path === 'project/test');
                expect(entry?.description).toBe('Test description');
            }
        }
    });

    it('should enforce 500 character limit', async () => {
        await expect(
            setCategoryDescriptionHandler(
                { config },
                {
                    path: 'project/test',
                    description: 'a'.repeat(501),
                }
            )
        ).rejects.toThrow();

        // 500 chars should work
        const result = await setCategoryDescriptionHandler(
            { config },
            {
                path: 'project/test',
                description: 'a'.repeat(500),
            }
        );
        expect(result.content[0]!.text).toContain('project/test');
    });

    it('should be idempotent on createCategory', async () => {
        // Create twice
        const result1 = await createCategoryHandler({ config }, { path: 'project/test' });
        const result2 = await createCategoryHandler({ config }, { path: 'project/test' });

        const output1 = JSON.parse(result1.content[0]!.text);
        const output2 = JSON.parse(result2.content[0]!.text);

        expect(output1.created).toBe(true);
        expect(output2.created).toBe(false);
    });

    it('should delete category with subcategories recursively', async () => {
        // Create nested structure
        await createCategoryHandler({ config }, { path: 'project/parent/child' });
        await setCategoryDescriptionHandler(
            { config },
            {
                path: 'project/parent/child',
                description: 'Child desc',
            }
        );

        // Delete parent
        await deleteCategoryHandler({ config }, { path: 'project/parent' });

        // Verify child is gone
        const storeRoot = join(testDir, 'default');
        const adapter = new FilesystemStorageAdapter({ rootDirectory: storeRoot });
        const exists = await adapter.categoryExists('project/parent/child');
        expect(exists.ok && exists.value).toBe(false);
    });
});
```

---

## Execution Order Summary

1. **Phase 1 (Parallel):**
    - Section 2: Index type changes + parser updates
    - Section 1: Core category module (types can be created, operations once types ready)

2. **Phase 2 (Sequential):**
    - Section 3: Storage port implementation (depends on 1 + 2)

3. **Phase 3 (Sequential):**
    - Section 4: MCP tools (depends on 1 + 3)

4. **Phase 4 (Parallel after Phase 3):**
    - Section 5: List memories update
    - Section 6: Validation tests

5. **Final:**
    - Integration testing
    - Documentation review
    - Commit
