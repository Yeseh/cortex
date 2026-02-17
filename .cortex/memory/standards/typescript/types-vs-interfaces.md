---
{created_at: 2026-02-17T19:14:04.705Z,updated_at: 2026-02-17T19:14:04.705Z,tags: [standard,typescript,types,interfaces],source: mcp}
---
# Types vs Interfaces Standard

## Rule
Use `type` for data structures, error/result types, and unions; use `interface` for contracts/ports meant to be implemented.

## Rationale
- `type` is restrictive and avoids accidental merging
- `interface` signals intent to implement and extend

## Examples

**Use `type` for:**
- `type MemoryMetadata = { ... }` (data structure)
- `type MemoryError = { code: ErrorCode, message: string }` (error type)
- `type Result<T, E> = Success<T> | Failure<E>` (union)

**Use `interface` for:**
- `interface MemoryStorage { ... }` (port/contract)
- `interface FilesystemStorageAdapterOptions { ... }` (extensible options)