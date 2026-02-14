---
created_at: 2026-02-14T13:54:02.905Z
updated_at: 2026-02-14T13:54:02.905Z
tags:
  - todo
  - refactor
  - storage-fs
  - domain-object
  - serialization
source: mcp
expires_at: 2026-02-16T14:00:00.000Z
citations:
  - packages/storage-fs/src/memories.ts
  - packages/core/src/storage/adapter.ts
---
# TODO: Update storage-fs to Return Domain Objects

The `storage-fs` package needs to be updated so that `MemoryStorage` returns domain objects instead of raw strings.

## Current State

`MemoryStorage` in storage-fs likely:
- `read()` returns `string | null`
- `write()` accepts `string`
- Serialization happens in core operations

## Required Changes

### 1. Update `MemoryStorage` Implementation

```typescript
// Before
async read(slugPath: string): Promise<Result<string | null, Error>> {
    const content = await readFile(path);
    return ok(content);
}

// After
async read(slugPath: MemoryPath): Promise<Result<Memory | null, Error>> {
    const content = await readFile(path);
    if (!content) return ok(null);
    
    // Parse and return domain object
    const memory = parseMemoryFile(content, slugPath);
    return memory;
}
```

### 2. Move Serialization into Storage Layer

- `parseMemory()` called inside `read()`
- `serializeMemory()` called inside `write()`
- Core operations no longer handle raw strings

### 3. Update Method Signatures

```typescript
interface MemoryStorage {
    read(slugPath: MemoryPath): Promise<Result<Memory | null, Error>>;
    write(memory: Memory): Promise<Result<void, Error>>;
    remove(slugPath: MemoryPath): Promise<Result<void, Error>>;
    move(from: MemoryPath, to: MemoryPath): Promise<Result<void, Error>>;
}
```

### 4. Path Handling

- Accept `MemoryPath` objects instead of strings
- Use `memoryPath.category.toString()` and `memoryPath.slug.toString()` for filesystem paths

### 5. Update Index Storage Similarly

- `updateAfterMemoryWrite(memory: Memory)` - receives domain object
- Extract metadata for index entry from `memory.metadata`