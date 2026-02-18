# Add MemoryClient Implementation Plan

**Goal:** Add MemoryClient class to complete the fluent client hierarchy (Cortex → StoreClient → CategoryClient → MemoryClient)
**Architecture:** MemoryClient wraps domain memory operations with lazy validation, following the same patterns as CategoryClient
**Tech Stack:** TypeScript, Bun, Result types
**Session Id:** ses_39000c61cffeHqFc7CM59GDGUM

---

## Implementation Tasks

### Task 1: Create MemoryClient Class (Implementation)

**File:** `packages/core/src/cortex/memory-client.ts`

Create the `MemoryClient` class following the `CategoryClient` pattern:

```typescript
/**
 * MemoryClient - Fluent API for memory operations.
 *
 * Provides a client interface for performing operations on individual memories.
 * Navigation methods are synchronous with lazy validation - invalid paths only
 * error on first async operation.
 *
 * @module core/cortex/memory-client
 */

import { ok, err, type Result } from '@/result.ts';
import type { ScopedStorageAdapter } from '@/storage/adapter.ts';
import { MemoryPath } from '@/memory/memory-path.ts';
import { Slug } from '@/slug.ts';
import type { Memory } from '@/memory/memory.ts';
import type { MemoryError } from '@/memory/result.ts';
import { createMemory, type CreateMemoryInput } from '@/memory/operations/create.ts';
import { getMemory, type GetMemoryOptions } from '@/memory/operations/get.ts';
import { updateMemory, type UpdateMemoryInput } from '@/memory/operations/update.ts';
import { removeMemory } from '@/memory/operations/remove.ts';
import { moveMemory } from '@/memory/operations/move.ts';

export class MemoryClient {
    /** Full path including category (e.g., "/standards/javascript/style") */
    readonly rawPath: string;

    /** Memory slug only (e.g., "style") */
    readonly rawSlug: string;

    /** Storage adapter for this memory's store */
    private readonly adapter: ScopedStorageAdapter;

    private constructor(rawPath: string, rawSlug: string, adapter: ScopedStorageAdapter) {
        this.rawPath = MemoryClient.normalizePath(rawPath);
        this.rawSlug = rawSlug;
        this.adapter = adapter;
    }

    /**
     * Creates a MemoryClient for a specific path.
     * @internal
     */
    static create(rawPath: string, rawSlug: string, adapter: ScopedStorageAdapter): MemoryClient {
        return new MemoryClient(rawPath, rawSlug, adapter);
    }

    private static normalizePath(path: string): string {
        // Same normalization as CategoryClient
        if (!path || path.trim() === '') {
            return '/';
        }
        let normalized = path.replace(/\/+/g, '/');
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }

    // Parsing methods
    parsePath(): Result<MemoryPath, MemoryError>;
    parseSlug(): Result<Slug, MemoryError>;

    // Lifecycle methods
    create(input: CreateMemoryInput): Promise<Result<Memory, MemoryError>>;
    get(options?: GetMemoryOptions): Promise<Result<Memory, MemoryError>>;
    update(input: UpdateMemoryInput): Promise<Result<Memory, MemoryError>>;
    delete(): Promise<Result<void, MemoryError>>;
    exists(): Promise<Result<boolean, MemoryError>>;

    // Movement
    move(destination: MemoryClient | MemoryPath): Promise<Result<MemoryClient, MemoryError>>;
}
```

**Key implementation notes:**

1. Follow CategoryClient pattern for constructor and static `create()` factory
2. Use lazy validation - paths validated only on first async operation
3. `parsePath()` converts rawPath (with leading slash) to MemoryPath by stripping leading slash
4. `parseSlug()` validates rawSlug using `Slug.from()`
5. All async methods must call parsing first to validate, then delegate to domain operations
6. `move()` returns new MemoryClient pointing to destination, preserving source client's rawPath

### Task 2: Update CategoryClient.getMemory() (Implementation)

**File:** `packages/core/src/cortex/category-client.ts`

Update the `getMemory()` method to return a real `MemoryClient` instead of the NOT_IMPLEMENTED error:

```typescript
import { MemoryClient } from './memory-client.ts';

// In CategoryClient class:
getMemory(slug: string): MemoryClient {
    // Construct full path: category rawPath + / + slug
    const memoryPath = this.rawPath === '/'
        ? '/' + slug
        : this.rawPath + '/' + slug;

    return MemoryClient.create(memoryPath, slug, this.adapter);
}
```

**Note:** Change return type from `Result<never, CategoryError>` to `MemoryClient`.

### Task 3: Export MemoryClient (Implementation)

**File:** `packages/core/src/cortex/index.ts`

Add export for MemoryClient:

```typescript
export { MemoryClient } from './memory-client.ts';
```

### Task 4: Write MemoryClient Unit Tests (Testing)

**File:** `packages/core/src/cortex/memory-client.spec.ts`

Test cases following the spec scenarios:

1. **Path and slug tests:**
    - `rawPath` and `rawSlug` are correct after construction
    - Path normalization (leading slash, trailing slash, multiple slashes)

2. **Parse tests:**
    - `parsePath()` returns valid MemoryPath
    - `parseSlug()` returns valid Slug

3. **Lazy validation tests:**
    - Invalid slug doesn't error on construction
    - Invalid slug errors with INVALID_PATH on first async operation (get, create, etc.)

4. **Lifecycle tests:**
    - `create()` wraps createMemory and returns Memory
    - `get()` wraps getMemory and returns Memory
    - `get({ includeExpired: true })` includes expired memories
    - `update()` wraps updateMemory and returns updated Memory
    - `delete()` wraps removeMemory and returns void
    - `exists()` returns boolean

5. **Move tests:**
    - `move(MemoryClient)` moves memory and returns new client
    - `move(MemoryPath)` moves memory and returns new client
    - Source client's rawPath unchanged after move
    - New client has correct rawPath matching destination

### Task 5: Write Integration Tests (Testing)

**File:** `packages/core/src/cortex/memory-client.spec.ts` (integration section)

1. Full navigation: `cortex.getStore().rootCategory().getCategory().getMemory()`
2. Create flow: `getMemory().create()` then `get()`
3. Update flow: `get()` then `update()`
4. Move flow: `move()` then verify old path doesn't exist

---

## Dependency Map

```
Task 1 (MemoryClient class) ────┬──► Task 2 (Update CategoryClient)
                                │
                                └──► Task 3 (Export)
                                │
                                └──► Task 4 (Unit Tests) ──► Task 5 (Integration Tests)
```

**Parallelization:**

- Task 1 must be completed first (core implementation)
- Tasks 2, 3, 4 can run in parallel after Task 1
- Task 5 depends on Tasks 2 and 4

---

## Validation Checklist

- [ ] `bun test packages/core` - all tests pass
- [ ] `bun run typecheck` - no errors
- [ ] `bun run lint` - no errors
