# Brainstorm: Fluent Client API (Azure SDK Style)

**Date:** 2026-02-17

## Context

With the `migrate-to-cortex-client` change in progress (PR #38), we want to expand the client API to provide a fluent, Azure SDK-style experience with hierarchical clients for stores, categories, and memories.

**Current pattern:**

```typescript
const adapter = cortex.getStore('my-store');
await adapter.value.memories.read(memoryPath);
```

**Target pattern:**

```typescript
cortex.getStore('my-store').rootCategory().getCategory('standards/javascript').getMemory('style');
```

## Design Principles

### 1. Synchronous Client Creation

All client factory methods (`getStore()`, `getCategory()`, `getMemory()`) return client objects immediately without hitting disk. This matches the Azure SDK pattern where you can create a client for a resource that may not exist.

### 2. Lazy Validation

Invalid paths (e.g., `'invalid//path'`, `'INVALID SLUG!!!'`) are accepted during client creation. Validation errors surface on the first async operation.

```typescript
// Succeeds synchronously, even with invalid input
const category = store.rootCategory().getCategory('invalid//path');

// Validation error surfaces here
const result = await category.exists();
// result.error.code === 'INVALID_PATH'
```

### 3. Result Types Throughout

Consistent with the existing codebase - all fallible async operations return `Result<T, E>`. No exceptions thrown for expected error conditions.

### 4. Clients Wrap Domain Operations

The existing operations in `core/memory/operations/` and `core/category/operations/` are reused. Clients provide a fluent API layer on top.

### 5. Category as Aggregate Root

Memories are only accessible through their containing category. There is no `store.getMemory(fullPath)` shortcut - you must navigate through the category tree.

## Client Hierarchy

```
Cortex
  └── getStore(name) → StoreClient
        └── rootCategory() → CategoryClient
              ├── getCategory(path) → CategoryClient
              ├── getMemory(slug) → MemoryClient
              └── parent() → CategoryClient | null
```

## StoreClient

Minimal surface - the store is a container for metadata and gateway to the category tree.

```typescript
class StoreClient {
    // Readonly metadata
    readonly name: string;
    readonly path: string; // Filesystem path
    readonly description?: string;

    // Entry point to category tree
    rootCategory(): CategoryClient;
}
```

## CategoryClient

The aggregate root for memories. Provides navigation, lifecycle, listing, and store-wide operations.

```typescript
class CategoryClient {
    // Raw identifier (canonical format with leading slash)
    readonly rawPath: string; // '/' for root, '/standards/javascript' for nested

    // Explicit parsing when value object needed
    parsePath(): Result<CategoryPath, PathError>;

    // Navigation (synchronous, lazy validation)
    getCategory(path: string): CategoryClient; // Relative or absolute path
    getMemory(slug: string): MemoryClient;
    parent(): CategoryClient | null; // null when at root

    // Lifecycle
    create(): Promise<Result<Category, CategoryError>>;
    delete(): Promise<Result<void, CategoryError>>; // Always recursive
    exists(): Promise<Result<boolean, CategoryError>>;

    // Metadata
    setDescription(description: string | null): Promise<Result<void, CategoryError>>;

    // Listing
    listMemories(options?: ListMemoriesOptions): Promise<Result<MemoryInfo[], CategoryError>>;
    listSubcategories(): Promise<Result<CategoryInfo[], CategoryError>>;

    // Store-wide operations (scoped to subtree, typically called on root)
    reindex(): Promise<Result<ReindexResult, CategoryError>>;
    prune(options?: PruneOptions): Promise<Result<PruneResult, CategoryError>>;
}
```

### Path Handling

Canonical format uses leading slash. Input is normalized:

- Add leading `/` if missing
- Strip trailing `/` (except root which is just `/`)
- Collapse multiple slashes (`//` → `/`)

```typescript
// All produce canonical '/standards'
root.getCategory('standards');
root.getCategory('/standards');
root.getCategory('/standards/');

// Navigation examples
const root = store.rootCategory();
root.rawPath; // '/'

const standards = root.getCategory('standards');
standards.rawPath; // '/standards'

const js = standards.getCategory('javascript');
js.rawPath; // '/standards/javascript'

// Parent navigation
js.parent().rawPath; // '/standards'
standards.parent().rawPath; // '/'
root.parent(); // null
```

### Delete Behavior

`delete()` is always recursive - deletes the category and all its contents. This is consistent with current behavior.

## MemoryClient

Provides lifecycle and movement operations for a single memory.

```typescript
class MemoryClient {
    // Raw identifiers (always accessible)
    readonly rawPath: string; // e.g., '/standards/javascript/style'
    readonly rawSlug: string; // e.g., 'style'

    // Explicit parsing when value objects needed
    parsePath(): Result<MemoryPath, PathError>;
    parseSlug(): Result<Slug, PathError>;

    // Lifecycle operations (validate lazily)
    create(input: CreateMemoryInput): Promise<Result<Memory, MemoryError>>;
    get(options?: GetMemoryOptions): Promise<Result<Memory, MemoryError>>;
    update(input: UpdateMemoryInput): Promise<Result<Memory, MemoryError>>;
    delete(): Promise<Result<void, MemoryError>>;
    exists(): Promise<Result<boolean, MemoryError>>;

    // Movement
    move(destination: MemoryClient | MemoryPath): Promise<Result<MemoryClient, MemoryError>>;
}
```

### Movement

`move()` accepts either a `MemoryClient` or a `MemoryPath` for type safety. Returns a new `MemoryClient` pointing to the destination.

```typescript
const style = category.getMemory('style');
const archive = root.getCategory('archive/2024');

// Move using another client
const moved = await style.move(archive.getMemory('old-style'));

// Move using a MemoryPath
const moved = await style.move(MemoryPath.of('/archive/2024/old-style'));
```

## Usage Examples

### Basic Navigation and Read

```typescript
const cortex = await Cortex.fromConfig('~/.config/cortex');
const store = cortex.getStore('my-project');
const memory = store.rootCategory().getCategory('standards/javascript').getMemory('style');

const result = await memory.get();
if (result.ok()) {
    console.log(result.value.content);
}
```

### Create Category and Memory

```typescript
const standards = store.rootCategory().getCategory('standards/typescript');
await standards.create();

const styleMemory = standards.getMemory('style-guide');
await styleMemory.create({
    content: '# TypeScript Style Guide\n...',
    tags: ['standards', 'typescript'],
});
```

### List and Iterate

```typescript
const root = store.rootCategory();

const categories = await root.listSubcategories();
if (categories.ok()) {
    for (const cat of categories.value) {
        console.log(cat.path, cat.description);
    }
}

const memories = await root.getCategory('standards').listMemories();
if (memories.ok()) {
    for (const mem of memories.value) {
        console.log(mem.path, mem.updatedAt);
    }
}
```

### Store-wide Operations

```typescript
const root = store.rootCategory();

// Reindex entire store
await root.reindex();

// Prune expired memories
const pruneResult = await root.prune({ dryRun: true });
if (pruneResult.ok()) {
    console.log(`Would prune ${pruneResult.value.count} memories`);
}
```

### Parent Navigation

```typescript
const deep = store.rootCategory().getCategory('project/cortex/api/handlers');

let current: CategoryClient | null = deep;
while (current) {
    console.log(current.rawPath);
    current = current.parent();
}
// Output:
// /project/cortex/api/handlers
// /project/cortex/api
// /project/cortex
// /project
// /
```

## Summary Table

| Client             | Properties                     | Navigation                                 | Lifecycle                                               | Listing                                 | Operations                                 |
| ------------------ | ------------------------------ | ------------------------------------------ | ------------------------------------------------------- | --------------------------------------- | ------------------------------------------ |
| **StoreClient**    | `name`, `path`, `description?` | `rootCategory()`                           | -                                                       | -                                       | -                                          |
| **CategoryClient** | `rawPath`                      | `getCategory()`, `getMemory()`, `parent()` | `create()`, `delete()`, `exists()`                      | `listMemories()`, `listSubcategories()` | `reindex()`, `prune()`, `setDescription()` |
| **MemoryClient**   | `rawPath`, `rawSlug`           | -                                          | `create()`, `get()`, `update()`, `delete()`, `exists()` | -                                       | `move()`                                   |

## Decisions Made

| Topic                   | Decision                                               | Rationale                                       |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| Client creation         | Synchronous                                            | Matches Azure SDK, enables fluent chaining      |
| Validation              | Lazy (on first async op)                               | Keeps creation simple, errors where expected    |
| Error handling          | `Result<T, E>`                                         | Consistent with existing codebase               |
| Domain operations       | Clients wrap them                                      | Reuse existing tested logic                     |
| Aggregate root          | Category owns memories                                 | No shortcuts - navigate through category tree   |
| `getStore()` returns    | `StoreClient` (not `Result`)                           | Store existence validated at config load        |
| `getCategory()`         | Works for subcategories too                            | Single method, accepts relative paths           |
| `parent()`              | Returns `CategoryClient \| null`                       | Useful for tree traversal                       |
| `delete()` behavior     | Always recursive                                       | Consistent with current implementation          |
| Path format             | Canonical leading slash                                | Normalized on input, stored consistently        |
| Raw vs parsed paths     | Raw strings as properties, explicit `parse*()` methods | Properties always accessible, validation opt-in |
| `move()` destination    | `MemoryClient \| MemoryPath`                           | Type safety for destination                     |
| `reindex()` / `prune()` | On CategoryClient                                      | Scoped to subtree, typically called on root     |

## Open Questions / Future Considerations

1. **Caching** - Should clients cache their parsed paths after first validation?
2. **Batch operations** - Future API for bulk create/update/delete?
3. **Subscriptions** - Watch for changes to a category or memory?
4. **Transactions** - Atomic multi-memory operations?

## References

- Azure SDK Design Guidelines: https://azure.github.io/azure-sdk/general_introduction.html
- Current `Cortex` class: `packages/core/src/cortex/cortex.ts`
- Memory operations: `packages/core/src/memory/operations/`
- Category operations: `packages/core/src/category/operations/`
- Related change: `openspec/changes/migrate-to-cortex-client/`
