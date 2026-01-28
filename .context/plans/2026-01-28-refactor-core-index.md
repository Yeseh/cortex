# Refactor Core Index Module Implementation Plan

**Goal:** Add comprehensive JSDoc documentation to `src/core/index/types.ts` and align error types with project standards.
**Architecture:** Documentation-only changes following the patterns established in `src/core/category/types.ts`. No behavioral changes.
**Tech Stack:** TypeScript, JSDoc
**Session Id:** ses_3fa1ce134ffe5SereLgQ781xy5

---

## Context

The `src/core/index/` module manages category index structures (memories list + subcategories list). It currently lacks comprehensive documentation compared to the exemplary `src/core/category/` module.

### Reference Files

- **Target file:** `src/core/index/types.ts` (43 lines)
- **Reference for style:** `src/core/category/types.ts` (206 lines)
- **Barrel export:** `src/core/index/index.ts` (7 lines)

### Blocked Tasks

Task 3 (Create operations.ts module) is **blocked** by `refactor-serialization-module` which will delete `parser.ts`. Operations cannot be extracted until the parser is deleted. Add a comment documenting this decision.

---

## Implementation Tasks

### Task 1: Add Module Header and Document Types

**File:** `src/core/index/types.ts`

#### 1.1 Add module header (replace current single-line comment)

```typescript
/**
 * Index types for category indexes.
 *
 * This module defines the data structures for category index files,
 * which track memories and subcategories within each category directory.
 * Index files enable efficient listing operations without scanning
 * the filesystem.
 *
 * @module core/index/types
 */
```

#### 1.2 Document IndexMemoryEntry interface

````typescript
/**
 * Entry for a memory within a category index.
 *
 * Each memory file in a category is tracked with its path and
 * estimated token count. The token estimate helps AI agents
 * decide which memories to load based on context window limits.
 *
 * @example
 * ```typescript
 * const entry: IndexMemoryEntry = {
 *   path: 'project/cortex/tech-stack',
 *   tokenEstimate: 150,
 *   summary: 'TypeScript project using Bun runtime'
 * };
 * ```
 */
export interface IndexMemoryEntry {
    /** Full path to the memory (e.g., "project/cortex/conventions") */
    path: string;
    /** Estimated token count for the memory content */
    tokenEstimate: number;
    /** Optional brief summary of memory contents (for listing displays) */
    summary?: string;
}
````

#### 1.3 Document IndexSubcategoryEntry interface

````typescript
/**
 * Entry for a subcategory within a category index.
 *
 * Subcategories are nested category directories. Each entry tracks
 * the total memory count for efficient hierarchy browsing without
 * recursively scanning the filesystem.
 *
 * @example
 * ```typescript
 * const entry: IndexSubcategoryEntry = {
 *   path: 'project/cortex',
 *   memoryCount: 5,
 *   description: 'Cortex memory system project knowledge'
 * };
 * ```
 */
export interface IndexSubcategoryEntry {
    /** Full path to the subcategory (e.g., "project/cortex") */
    path: string;
    /** Total number of memories in this subcategory */
    memoryCount: number;
    /** Optional description (max 500 chars) for the subcategory */
    description?: string;
}
````

#### 1.4 Document CategoryIndex interface

````typescript
/**
 * Complete index structure for a category directory.
 *
 * Each category directory contains an `index.yaml` file with this
 * structure, listing all direct memories and subcategories. The
 * index is maintained automatically when memories are written or
 * deleted, and can be rebuilt via the `reindex` command.
 *
 * @example
 * ```typescript
 * const index: CategoryIndex = {
 *   memories: [
 *     { path: 'project/tech-stack', tokenEstimate: 150 },
 *     { path: 'project/conventions', tokenEstimate: 200 }
 *   ],
 *   subcategories: [
 *     { path: 'project/cortex', memoryCount: 5 }
 *   ]
 * };
 * ```
 */
export interface CategoryIndex {
    /** List of memory entries in this category */
    memories: IndexMemoryEntry[];
    /** List of subcategory entries in this category */
    subcategories: IndexSubcategoryEntry[];
}
````

#### 1.5 Document IndexParseErrorCode

```typescript
/**
 * Error codes for index parsing failures.
 *
 * These codes enable programmatic error handling:
 * - `INVALID_FORMAT` - The index file structure is malformed (not valid YAML-like format)
 * - `INVALID_SECTION` - Entry appears outside a valid section (memories/subcategories)
 * - `INVALID_ENTRY` - Entry has invalid structure or unexpected fields
 * - `MISSING_FIELD` - Required field (path, token_estimate, memory_count) is missing
 * - `INVALID_NUMBER` - Numeric field (token_estimate, memory_count) has invalid value
 */
export type IndexParseErrorCode =
    | 'INVALID_FORMAT'
    | 'INVALID_SECTION'
    | 'INVALID_ENTRY'
    | 'MISSING_FIELD'
    | 'INVALID_NUMBER';
```

#### 1.6 Document IndexParseError interface

```typescript
/**
 * Error details for index parsing failures.
 *
 * Provides structured error information including the error code,
 * human-readable message, and optional context about the failing
 * line or field.
 */
export interface IndexParseError {
    /** Machine-readable error code for programmatic handling */
    code: IndexParseErrorCode;
    /** Human-readable error message */
    message: string;
    /** Line number where the error occurred (1-based) */
    line?: number;
    /** Field name that caused the error (when applicable) */
    field?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
}
```

#### 1.7 Document IndexSerializeErrorCode

```typescript
/**
 * Error codes for index serialization failures.
 *
 * These codes enable programmatic error handling:
 * - `INVALID_ENTRY` - Entry has missing or empty required fields (path)
 * - `INVALID_NUMBER` - Numeric field is not a valid finite non-negative number
 */
export type IndexSerializeErrorCode = 'INVALID_ENTRY' | 'INVALID_NUMBER';
```

#### 1.8 Document IndexSerializeError interface

```typescript
/**
 * Error details for index serialization failures.
 *
 * Provides structured error information for failures during
 * index-to-string conversion.
 */
export interface IndexSerializeError {
    /** Machine-readable error code for programmatic handling */
    code: IndexSerializeErrorCode;
    /** Human-readable error message */
    message: string;
    /** Field name that caused the error (when applicable) */
    field?: string;
    /** Underlying error that caused this failure (for debugging) */
    cause?: unknown;
}
```

### Task 2: Add INDEX_FILE_NAME Constant

Add after the interfaces:

```typescript
/**
 * Standard filename for category index files.
 *
 * Each category directory contains an index file with this name,
 * storing the {@link CategoryIndex} structure in YAML format.
 */
export const INDEX_FILE_NAME = 'index.yaml';
```

### Task 3: Update Barrel Export

**File:** `src/core/index/index.ts`

````typescript
/**
 * Index module for category index management.
 *
 * This module provides types and utilities for working with category
 * index files, which track memories and subcategories within each
 * category directory.
 *
 * @module core/index
 *
 * @example
 * ```typescript
 * import { CategoryIndex, parseCategoryIndex, serializeCategoryIndex } from './core/index';
 *
 * // Parse an index file
 * const result = parseCategoryIndex(rawYaml);
 * if (result.ok) {
 *   console.log(result.value.memories.length);
 * }
 *
 * // Serialize an index
 * const serialized = serializeCategoryIndex(index);
 * ```
 */

export * from './types.ts';
export * from './parser.ts';
````

---

## Verification

After implementation:

1. Run typecheck: `bun run typecheck`
2. Run tests: `bun test src/core/index`
3. Verify documentation renders in IDE hover
4. Compare style with `src/core/category/types.ts`

---

## Blocked Work

Task 3 from the proposal (Create operations.ts module) cannot proceed until `refactor-serialization-module` completes and deletes `parser.ts`. Document this in a code comment in the barrel export.
