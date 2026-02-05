---
created_at: 2026-02-05T20:12:28.369Z
updated_at: 2026-02-05T20:12:28.369Z
tags:
  - errors
  - cli
  - patterns
  - storage
source: mcp
---
# CLI Storage Error Pattern

## Rule
CLI commands MUST use the domain-level `STORAGE_ERROR` code when handling storage adapter failures, rather than exposing infrastructure-level codes like `IO_READ_ERROR` or `IO_WRITE_ERROR`.

## Rationale
- Storage adapter codes (`IO_READ_ERROR`, `IO_WRITE_ERROR`, `INDEX_ERROR`) are implementation details
- CLI consumers should see consistent, domain-appropriate error codes
- Keeps the CLI error contract stable even if storage internals change

## Pattern
```typescript
// In CLI command handlers:
const readResult = await adapter.readMemoryFile(path);
if (!readResult.ok) {
    mapCoreError({ code: 'STORAGE_ERROR', message: readResult.error.message });
}

const writeResult = await adapter.writeMemoryFile(path, content);
if (!writeResult.ok) {
    mapCoreError({ code: 'STORAGE_ERROR', message: writeResult.error.message });
}
```

## Affected Commands
- `memory add` - storage write errors
- `memory show` - storage read errors  
- `memory list` - storage read errors
- `memory update` - storage read/write errors
- `store prune` - storage write errors

## Reference
Established during the storage error code rename refactor (commit 9e1eace, 2026-02-05).