---
created_at: 2026-01-27T21:03:15.850Z
updated_at: 2026-01-27T21:03:15.850Z
tags: [standards, typescript, types, interfaces, structural-typing]
source: mcp
---
Use `type` for pure data structures and `interface` for contracts/ports.

**Use `type` for:**
- Data structures (records, objects that are just data)
- Error types
- Result types
- Union types / discriminated unions
- Any purely structural typing

```typescript
// Data structure - use type
export type MemoryMetadata = {
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    source: string;
    expiresAt?: Date;
};

// Error type - use type
export type MemoryError = {
    code: MemoryErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
};
```

**Use `interface` for:**
- Contracts that will be implemented (ports, adapters)
- Abstract storage interfaces
- Service interfaces

```typescript
// Contract/port - use interface
export interface MemoryStorage {
    read(path: string): Promise<Result<Memory | null, MemoryError>>;
    write(path: string, memory: Memory): Promise<Result<void, MemoryError>>;
    delete(path: string): Promise<Result<void, MemoryError>>;
}

// Adapter options that might be extended - use interface
export interface FilesystemStorageAdapterOptions {
    basePath: string;
    createIfMissing?: boolean;
}
```

**Rationale:**
- `type` is more restrictive (can't be merged/extended accidentally)
- `interface` signals "this is meant to be implemented"
- Clearer intent when reading code