# Plan: Consolidate Memory Operations into Core

## Goal

Remove duplicated business logic from MCP server and CLI by consolidating it into core library operations. Both entry points become thin adapters that handle I/O concerns (parsing, formatting) while core handles domain logic.

## Principles Applied

1. **Core operations** accept `ComposedStorageAdapter` interface
2. **Dry-run is core** - prune operation supports `dryRun` natively
3. **Unified domain errors** - single `MemoryError` type that entry points translate
4. **Move is core** - include `moveMemory()` with proper pre-flight checks
5. **Tests included** - create/update tests for new core operations

---

## Analysis Summary

### Duplicated Logic Identified

| Logic                       | MCP Location                     | CLI Location                                                    | Core Target                    |
| --------------------------- | -------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| `isExpired()`               | `server/memory/tools.ts:228`     | `cli/commands/list.ts:96`, `cli/commands/prune.ts:69`           | `core/memory/expiration.ts`    |
| ROOT_CATEGORIES             | `server/memory/tools.ts:166`     | `cli/commands/list.ts:217`, `cli/commands/prune.ts:179`         | `core/category/types.ts`       |
| Memory collection/traversal | `server/memory/tools.ts:633-679` | `cli/commands/list.ts:155-241`, `cli/commands/prune.ts:130-197` | `core/memory/operations.ts`    |
| Prune logic                 | `server/memory/tools.ts:757-824` | `cli/commands/prune.ts:199-268`                                 | `core/memory/operations.ts`    |
| Update logic                | `server/memory/tools.ts:370-457` | `cli/commands/update.ts:276-420`                                | `core/memory/operations.ts`    |
| Add/create logic            | `server/memory/tools.ts:256-305` | `cli/commands/add.ts:214-280`                                   | `core/memory/operations.ts`    |
| Store resolution            | `server/memory/tools.ts:178-216` | `server/category/tools.ts:160-198`                              | `server/helpers.ts` (optional) |

---

## Implementation Tasks

### Phase 1: Core Foundation

#### 1.1 Create expiration utilities

**File:** `src/core/memory/expiration.ts` (NEW)

```typescript
/**
 * Memory expiration utilities.
 * @module core/memory/expiration
 */

/**
 * Checks if a memory has expired relative to a given time.
 *
 * @param expiresAt - Memory expiration date (undefined means no expiration)
 * @param now - Current time for comparison
 * @returns true if the memory has expired (expiresAt <= now)
 */
export const isExpired = (expiresAt: Date | undefined, now: Date): boolean => {
    if (!expiresAt) {
        return false;
    }
    return expiresAt.getTime() <= now.getTime();
};

/**
 * Checks if a memory has expired using current time.
 * Convenience wrapper around isExpired().
 *
 * @param expiresAt - Memory expiration date (undefined means no expiration)
 * @returns true if the memory has expired
 */
export const isExpiredNow = (expiresAt: Date | undefined): boolean => {
    return isExpired(expiresAt, new Date());
};
```

#### 1.2 Add ROOT_CATEGORIES constant

**File:** `src/core/category/types.ts` (MODIFY)

Add at end of file:

```typescript
/**
 * Root memory categories that organize the top-level structure.
 * These categories cannot be deleted or have descriptions set.
 */
export const ROOT_CATEGORIES = ['human', 'persona', 'project', 'domain'] as const;

/** Type for root category names */
export type RootCategory = (typeof ROOT_CATEGORIES)[number];
```

**File:** `src/core/category/index.ts` (MODIFY)

Add export:

```typescript
export { ROOT_CATEGORIES, type RootCategory } from './types.ts';
```

#### 1.3 Add missing error codes

**File:** `src/core/memory/types.ts` (MODIFY)

Add to `MemoryErrorCode`:

```typescript
export type MemoryErrorCode =
    // Existing codes...
    | 'MISSING_FRONTMATTER'
    | 'INVALID_FRONTMATTER'
    | 'MISSING_FIELD'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TAGS'
    | 'INVALID_SOURCE'
    | 'MEMORY_NOT_FOUND'
    | 'STORAGE_ERROR'
    | 'INVALID_PATH'
    | 'MEMORY_EXPIRED'
    // New codes:
    | 'INVALID_INPUT' // No updates provided, invalid arguments
    | 'DESTINATION_EXISTS'; // Move destination already exists
```

#### 1.4 Update core memory exports

**File:** `src/core/memory/index.ts` (MODIFY)

Add exports for expiration utilities (operations added in Phase 2):

```typescript
// Expiration utilities
export { isExpired, isExpiredNow } from './expiration.ts';
```

---

### Phase 2: Core Operations

#### 2.1 Create memory operations module

**File:** `src/core/memory/operations.ts` (NEW)

**Types:**

```typescript
import type { Result } from '../types.ts';
import type { ComposedStorageAdapter } from '../storage/adapter.ts';
import type { MemoryError } from './types.ts';
import type { MemoryFileContents } from './index.ts';

// ============================================================================
// Input Types
// ============================================================================

/** Input for creating a new memory */
export interface CreateMemoryInput {
    /** Memory content (markdown) */
    content: string;
    /** Tags for categorization */
    tags?: string[];
    /** Source identifier (e.g., "cli", "mcp", "user") */
    source: string;
    /** Optional expiration timestamp */
    expiresAt?: Date;
}

/** Input for updating an existing memory */
export interface UpdateMemoryInput {
    /** New content (undefined = keep existing) */
    content?: string;
    /** New tags (undefined = keep existing) */
    tags?: string[];
    /** New expiration (undefined = keep existing) */
    expiresAt?: Date;
    /** If true, removes expiration */
    clearExpiry?: boolean;
}

/** Options for retrieving a memory */
export interface GetMemoryOptions {
    /** Include expired memories (default: false) */
    includeExpired?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

/** Options for listing memories */
export interface ListMemoriesOptions {
    /** Category to list (undefined = all root categories) */
    category?: string;
    /** Include expired memories (default: false) */
    includeExpired?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

/** Options for pruning expired memories */
export interface PruneOptions {
    /** If true, return what would be pruned without deleting */
    dryRun?: boolean;
    /** Current time for expiration check */
    now?: Date;
}

// ============================================================================
// Result Types
// ============================================================================

/** A memory entry in list results */
export interface ListedMemory {
    /** Full path to the memory */
    path: string;
    /** Estimated token count */
    tokenEstimate: number;
    /** Brief summary if available */
    summary?: string;
    /** Expiration timestamp if set */
    expiresAt?: Date;
    /** Whether the memory is currently expired */
    isExpired: boolean;
}

/** A subcategory entry in list results */
export interface ListedSubcategory {
    /** Full path to the subcategory */
    path: string;
    /** Total memories in this subcategory */
    memoryCount: number;
    /** Category description if set */
    description?: string;
}

/** Result of listing memories */
export interface ListMemoriesResult {
    /** Category that was listed (empty string for root) */
    category: string;
    /** Memories found */
    memories: ListedMemory[];
    /** Direct subcategories */
    subcategories: ListedSubcategory[];
}

/** A pruned memory entry */
export interface PrunedMemory {
    /** Path of the pruned memory */
    path: string;
    /** When it expired */
    expiresAt: Date;
}

/** Result of prune operation */
export interface PruneResult {
    /** Memories that were (or would be) pruned */
    pruned: PrunedMemory[];
}
```

**Operations:**

```typescript
// ============================================================================
// Operations
// ============================================================================

/**
 * Creates a new memory at the specified path.
 * Auto-creates parent categories as needed.
 *
 * @param storage - Storage adapter
 * @param slugPath - Memory path (e.g., "project/cortex/config")
 * @param input - Memory content and metadata
 * @param now - Current time for timestamps (default: new Date())
 * @returns Result with void on success
 *
 * @errors
 * - INVALID_PATH: Path is malformed
 * - STORAGE_ERROR: Write failed
 */
export const createMemory = async (
    storage: ComposedStorageAdapter,
    slugPath: string,
    input: CreateMemoryInput,
    now?: Date
): Promise<Result<void, MemoryError>>;

/**
 * Retrieves a memory with optional expiration filtering.
 *
 * @param storage - Storage adapter
 * @param slugPath - Memory path
 * @param options - Retrieval options
 * @returns Result with memory contents
 *
 * @errors
 * - INVALID_PATH: Path is malformed
 * - MEMORY_NOT_FOUND: Memory does not exist
 * - MEMORY_EXPIRED: Memory exists but is expired (unless includeExpired)
 * - STORAGE_ERROR: Read failed
 */
export const getMemory = async (
    storage: ComposedStorageAdapter,
    slugPath: string,
    options?: GetMemoryOptions
): Promise<Result<MemoryFileContents, MemoryError>>;

/**
 * Updates an existing memory's content or metadata.
 *
 * @param storage - Storage adapter
 * @param slugPath - Memory path
 * @param updates - Fields to update
 * @param now - Current time for updatedAt (default: new Date())
 * @returns Result with updated memory contents
 *
 * @errors
 * - INVALID_PATH: Path is malformed
 * - MEMORY_NOT_FOUND: Memory does not exist
 * - INVALID_INPUT: No updates provided
 * - STORAGE_ERROR: Read or write failed
 */
export const updateMemory = async (
    storage: ComposedStorageAdapter,
    slugPath: string,
    updates: UpdateMemoryInput,
    now?: Date
): Promise<Result<MemoryFileContents, MemoryError>>;

/**
 * Moves a memory to a new path.
 * Performs pre-flight checks for source existence and destination collision.
 * Auto-creates destination category as needed.
 *
 * @param storage - Storage adapter
 * @param fromPath - Current memory path
 * @param toPath - Target memory path
 * @returns Result with void on success
 *
 * @errors
 * - INVALID_PATH: Source or destination path is malformed
 * - MEMORY_NOT_FOUND: Source memory does not exist
 * - DESTINATION_EXISTS: Target path already has a memory
 * - STORAGE_ERROR: Move operation failed
 */
export const moveMemory = async (
    storage: ComposedStorageAdapter,
    fromPath: string,
    toPath: string
): Promise<Result<void, MemoryError>>;

/**
 * Removes a memory and updates indexes.
 *
 * @param storage - Storage adapter
 * @param slugPath - Memory path
 * @returns Result with void on success
 *
 * @errors
 * - INVALID_PATH: Path is malformed
 * - MEMORY_NOT_FOUND: Memory does not exist
 * - STORAGE_ERROR: Delete or reindex failed
 */
export const removeMemory = async (
    storage: ComposedStorageAdapter,
    slugPath: string
): Promise<Result<void, MemoryError>>;

/**
 * Lists memories in a category or all root categories.
 * Optionally includes expired memories.
 *
 * @param storage - Storage adapter
 * @param options - Listing options
 * @returns Result with memories and subcategories
 *
 * @errors
 * - STORAGE_ERROR: Failed to read indexes or memories
 */
export const listMemories = async (
    storage: ComposedStorageAdapter,
    options?: ListMemoriesOptions
): Promise<Result<ListMemoriesResult, MemoryError>>;

/**
 * Finds and optionally deletes all expired memories.
 *
 * @param storage - Storage adapter
 * @param options - Prune options (dryRun to preview without deleting)
 * @returns Result with list of pruned memories
 *
 * @errors
 * - STORAGE_ERROR: Failed to read, delete, or reindex
 */
export const pruneExpiredMemories = async (
    storage: ComposedStorageAdapter,
    options?: PruneOptions
): Promise<Result<PruneResult, MemoryError>>;
```

#### 2.2 Update core memory exports

**File:** `src/core/memory/index.ts` (MODIFY)

Add operations exports:

```typescript
// Operations
export {
    createMemory,
    getMemory,
    updateMemory,
    moveMemory,
    removeMemory,
    listMemories,
    pruneExpiredMemories,
    type CreateMemoryInput,
    type UpdateMemoryInput,
    type GetMemoryOptions,
    type ListMemoriesOptions,
    type PruneOptions,
    type ListedMemory,
    type ListedSubcategory,
    type ListMemoriesResult,
    type PrunedMemory,
    type PruneResult,
} from './operations.ts';
```

---

### Phase 3: Tests for Core Operations

#### 3.1 Create expiration utility tests

**File:** `src/core/memory/expiration.spec.ts` (NEW)

Test cases:

- `isExpired(undefined, now)` returns false
- `isExpired(futureDate, now)` returns false
- `isExpired(pastDate, now)` returns true
- `isExpired(exactlyNow, now)` returns true (edge case: expired at boundary)
- `isExpiredNow()` uses current time correctly

#### 3.2 Create operation tests

**File:** `src/core/memory/operations.spec.ts` (NEW)

Test cases per operation:

**createMemory:**

- Creates memory with all fields
- Creates memory with minimal fields (no tags, no expiry)
- Auto-creates parent category
- Returns INVALID_PATH for malformed path

**getMemory:**

- Returns memory when found
- Returns MEMORY_NOT_FOUND when missing
- Returns MEMORY_EXPIRED when expired and includeExpired=false
- Returns expired memory when includeExpired=true

**updateMemory:**

- Updates content only
- Updates tags only
- Updates expiry only
- Clears expiry with clearExpiry=true
- Updates multiple fields
- Returns INVALID_INPUT when no updates provided
- Returns MEMORY_NOT_FOUND when missing

**moveMemory:**

- Moves memory successfully
- Returns MEMORY_NOT_FOUND for missing source
- Returns DESTINATION_EXISTS for existing destination
- Auto-creates destination category

**removeMemory:**

- Removes existing memory
- Returns MEMORY_NOT_FOUND for missing memory

**listMemories:**

- Lists specific category
- Lists all root categories when no category specified
- Filters expired memories by default
- Includes expired memories when includeExpired=true
- Returns empty results for empty category

**pruneExpiredMemories:**

- Dry run returns candidates without deleting
- Actual run deletes and returns pruned list
- Returns empty list when no expired memories
- Triggers reindex after deletion

---

### Phase 4: Update CLI Commands

#### 4.1 Update add command

**File:** `src/cli/commands/add.ts` (MODIFY)

Replace:

```typescript
// Current: Build MemoryFileContents manually, serialize, write
const memoryContents: MemoryFileContents = { ... };
const serialized = serializeMemoryFile(memoryContents);
await adapter.writeMemoryFile(...);
```

With:

```typescript
import { createMemory } from '../../core/memory/index.ts';

const result = await createMemory(adapter, slugPath, {
    content: contentResult.value.content,
    tags: parsed.value.tags,
    source: contentResult.value.source,
    expiresAt: parsed.value.expiresAt,
});
```

#### 4.2 Update show command

**File:** `src/cli/commands/show.ts` (MODIFY)

Replace:

```typescript
// Current: Read raw, parse, check manually
const readResult = await adapter.readMemoryFile(slugPath);
const parsedMemory = parseMemoryFile(readResult.value);
```

With:

```typescript
import { getMemory } from '../../core/memory/index.ts';

const result = await getMemory(adapter, slugPath, {
    includeExpired: true, // CLI shows expired with warning
});
```

Note: May want to add `--include-expired` flag or show expiry warning.

#### 4.3 Update update command

**File:** `src/cli/commands/update.ts` (MODIFY)

Replace:

```typescript
// Current: loadMemoryForUpdate, buildUpdatedMemory, persistUpdatedMemory
```

With:

```typescript
import { updateMemory } from '../../core/memory/index.ts';

const result = await updateMemory(adapter, slugPath, {
    content: contentInput.content ?? undefined,
    tags: parsedArgs.value.tags,
    expiresAt: parsedArgs.value.expiresAt,
    clearExpiry: parsedArgs.value.clearExpiry,
});
```

Delete local functions:

- `loadMemoryForUpdate()`
- `buildUpdatedMemory()`
- `persistUpdatedMemory()`

#### 4.4 Update move command

**File:** `src/cli/commands/move.ts` (MODIFY)

Replace:

```typescript
// Current: Validate paths, call adapter.moveMemoryFile directly
```

With:

```typescript
import { moveMemory } from '../../core/memory/index.ts';

const result = await moveMemory(adapter, sourcePath, destinationPath);
```

Gains: Pre-flight checks (source exists, destination doesn't exist).

#### 4.5 Update list command

**File:** `src/cli/commands/list.ts` (MODIFY)

Replace:

```typescript
// Current: collectMemoriesFromCategory, collectAllCategories, isExpired, etc.
```

With:

```typescript
import { listMemories } from '../../core/memory/index.ts';

const result = await listMemories(adapter, {
    category: parsed.value.category,
    includeExpired: parsed.value.includeExpired,
});
```

Delete local functions:

- `isExpired()`
- `loadMemoryExpiry()`
- `loadCategoryIndex()`
- `collectMemoriesFromCategory()`
- `collectAllCategories()`
- Hardcoded `rootCategories` array

#### 4.6 Update prune command

**File:** `src/cli/commands/prune.ts` (MODIFY)

Replace:

```typescript
// Current: collectAllExpired, deleteExpiredMemories, manual reindex
```

With:

```typescript
import { pruneExpiredMemories } from '../../core/memory/index.ts';

const result = await pruneExpiredMemories(adapter, {
    dryRun: parsed.value.dryRun,
});
```

Delete local functions:

- `isExpired()`
- `loadCategoryIndex()`
- `checkMemoryExpiry()`
- `collectExpiredFromCategory()`
- `collectAllExpired()`
- `deleteExpiredMemories()`
- Hardcoded `rootCategories` array

---

### Phase 5: Update MCP Server

#### 5.1 Update memory tools

**File:** `src/server/memory/tools.ts` (MODIFY)

Replace handlers with core operation calls:

| Handler                | Current Implementation                          | New Implementation                       |
| ---------------------- | ----------------------------------------------- | ---------------------------------------- |
| `addMemoryHandler`     | Build frontmatter, serialize, write             | `createMemory(adapter, path, input)`     |
| `getMemoryHandler`     | Read raw, parse, check expiry                   | `getMemory(adapter, path, options)`      |
| `updateMemoryHandler`  | Load, merge, serialize, write                   | `updateMemory(adapter, path, updates)`   |
| `removeMemoryHandler`  | Remove file, reindex                            | `removeMemory(adapter, path)`            |
| `moveMemoryHandler`    | Check source, check dest, create category, move | `moveMemory(adapter, from, to)`          |
| `listMemoriesHandler`  | collectMemories, collectDirectSubcategories     | `listMemories(adapter, options)`         |
| `pruneMemoriesHandler` | collectExpired, delete each, reindex            | `pruneExpiredMemories(adapter, options)` |

Delete local functions:

- `isExpired()`
- `ROOT_CATEGORIES` constant
- `collectMemories()`
- `collectDirectSubcategories()`
- `collectExpired()`

#### 5.2 Extract shared MCP helpers (optional)

**File:** `src/server/helpers.ts` (NEW - optional)

Extract from `memory/tools.ts` and `category/tools.ts`:

```typescript
/**
 * Shared helpers for MCP server tools.
 * @module server/helpers
 */

import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { Result } from '../core/types.ts';
import { loadStoreRegistry, resolveStorePath } from '../core/store/registry.ts';
import type { ServerConfig } from './config.ts';

/**
 * Resolves a store name to its root directory path.
 * Optionally creates the directory if it doesn't exist.
 */
export const resolveStoreRoot = async (
    config: ServerConfig,
    storeName: string,
    autoCreate: boolean
): Promise<Result<string, McpError>>;

/**
 * Parses and validates input against a Zod schema.
 * Throws McpError on validation failure.
 */
export const parseInput = <T>(schema: z.ZodSchema<T>, input: unknown): T;
```

---

### Phase 6: Integration Testing

#### 6.1 Verify CLI integration tests

**Files:** `src/cli/tests/*.spec.ts`

Run existing tests to ensure they pass with new core operation usage.
Update any tests that mock internal functions that no longer exist.

#### 6.2 Verify MCP server tests

**Files:** `src/server/**/*.spec.ts`

Run existing tests to ensure they pass with new core operation usage.
Update any tests that mock internal functions that no longer exist.

---

## File Change Summary

| File                                 | Action            | Phase | Priority |
| ------------------------------------ | ----------------- | ----- | -------- |
| `src/core/memory/expiration.ts`      | CREATE            | 1     | P1       |
| `src/core/memory/expiration.spec.ts` | CREATE            | 3     | P1       |
| `src/core/memory/types.ts`           | MODIFY            | 1     | P1       |
| `src/core/category/types.ts`         | MODIFY            | 1     | P1       |
| `src/core/category/index.ts`         | MODIFY            | 1     | P1       |
| `src/core/memory/index.ts`           | MODIFY            | 1, 2  | P1       |
| `src/core/memory/operations.ts`      | CREATE            | 2     | P2       |
| `src/core/memory/operations.spec.ts` | CREATE            | 3     | P2       |
| `src/cli/commands/add.ts`            | MODIFY            | 4     | P3       |
| `src/cli/commands/show.ts`           | MODIFY            | 4     | P3       |
| `src/cli/commands/update.ts`         | MODIFY            | 4     | P3       |
| `src/cli/commands/move.ts`           | MODIFY            | 4     | P3       |
| `src/cli/commands/list.ts`           | MODIFY            | 4     | P3       |
| `src/cli/commands/prune.ts`          | MODIFY            | 4     | P3       |
| `src/server/memory/tools.ts`         | MODIFY            | 5     | P4       |
| `src/server/helpers.ts`              | CREATE (optional) | 5     | P4       |

---

## Related Work

- **TODO:** Rename storage error codes that leak implementation details
    - Tracked in: `global:projects/cortex/todo/rename-storage-error-codes`

---

## Success Criteria

1. All duplicated `isExpired()` functions removed from CLI and MCP
2. All hardcoded `ROOT_CATEGORIES` arrays removed, using single constant
3. CLI commands delegate to core operations for business logic
4. MCP handlers delegate to core operations for business logic
5. All existing tests pass
6. New core operation tests provide coverage for:
    - Happy paths
    - Error conditions (not found, invalid input, etc.)
    - Edge cases (expiration boundaries, empty results)
7. No regression in CLI or MCP behavior
