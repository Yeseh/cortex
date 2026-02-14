---
created_at: 2026-02-14T13:48:49.330Z
updated_at: 2026-02-14T13:48:49.330Z
tags:
  - refactor
  - pattern
  - storage
  - domain-object
  - serialization
source: mcp
expires_at: 2026-02-16T14:00:00.000Z
citations:
  - packages/core/src/storage/adapter.ts
  - packages/core/src/memory/operations/create.ts
  - packages/core/src/memory/operations/get.ts
---
# Storage Interface Pattern: Domain Objects

Storage interfaces now work with domain objects instead of raw strings.

## Before (Old Pattern)

```typescript
interface MemoryStorage {
    read(slugPath: string): Promise<Result<string | null, Error>>;
    write(slugPath: string, contents: string): Promise<Result<void, Error>>;
}

// Operations had to serialize/deserialize
const createMemory = async (
    storage: ScopedStorageAdapter,
    serializer: MemorySerializer,  // ❌ Operations needed serializer
    path: string,
    input: CreateMemoryInput,
) => {
    const memory = buildMemory(input);
    const serialized = serializer.serialize(memory);  // ❌ Manual serialization
    await storage.memories.write(path, serialized.value);
};
```

## After (New Pattern)

```typescript
interface MemoryStorage {
    read(slugPath: MemoryPath): Promise<Result<Memory | null, Error>>;
    write(contents: Memory): Promise<Result<void, Error>>;
    remove(slugPath: MemoryPath): Promise<Result<void, Error>>;
    move(from: MemoryPath, to: MemoryPath): Promise<Result<void, Error>>;
}

// Operations work directly with domain objects
const createMemory = async (
    storage: ScopedStorageAdapter,
    path: string,
    input: CreateMemoryInput,
) => {
    const memoryResult = Memory.init(path, metadata, content);
    if (!memoryResult.ok()) return memoryResult;
    
    // Storage handles serialization internally
    await storage.memories.write(memoryResult.value);  // ✅ Pass domain object
};
```

## Key Changes

1. **No serializer in operations** - Storage layer handles serialization
2. **Type-safe paths** - Use `MemoryPath` instead of `string`
3. **Storage returns domain objects** - `Memory | null` not `string | null`
4. **Memory includes path** - `Memory.path` is a `MemoryPath`

## Benefits

- Operations are simpler (no serializer parameter)
- Type safety for paths prevents invalid path strings
- Separation of concerns: storage knows format, core knows domain