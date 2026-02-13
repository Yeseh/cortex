## 1. Index changes — Add `updatedAt` to `IndexMemoryEntry`

- [x] 1.1 Add optional `updatedAt?: Date` field to `IndexMemoryEntry` in `packages/core/src/index/types.ts`
- [x] 1.2 Add `updated_at` (optional) to `IndexMemoryEntrySchema` Zod schema in `packages/core/src/serialization.ts`
- [x] 1.3 Update `parseIndex` to deserialize `updated_at` → `updatedAt` on memory entries
- [x] 1.4 Update `serializeIndex` to serialize `updatedAt` → `updated_at` on memory entries
- [x] 1.5 Add/update tests for index round-trip with `updatedAt` present and absent

## 2. Index write — Populate `updatedAt` on memory create/update

- [x] 2.1 Update `createMemory` in `packages/core/src/memory/operations.ts` to include `updatedAt` in the index entry written after creation
- [x] 2.2 Update `updateMemory` in `packages/core/src/memory/operations.ts` to include `updatedAt` in the index entry written after update
- [x] 2.3 Add tests verifying index entries contain `updatedAt` after create and update

## 3. Reindex — Populate `updatedAt` from frontmatter

- [x] 3.1 Update reindex logic (in `packages/core/src/index/operations.ts` or equivalent) to read `updated_at` from each memory's frontmatter and populate `updatedAt` on the index entry
- [x] 3.2 Add test for reindex producing entries with `updatedAt` populated from frontmatter
- [x] 3.3 Add test for reindex with memories missing `updated_at` in frontmatter (entry `updatedAt` is undefined)

## 4. Core operation — `getRecentMemories()`

- [x] 4.1 Define `GetRecentMemoriesOptions` and `GetRecentMemoriesResult` types in `packages/core/src/memory/operations.ts`
- [x] 4.2 Implement `getRecentMemories()` function: walk categories recursively, collect index entries, filter expired, sort by `updatedAt` desc, slice to limit, read full content
- [x] 4.3 Add tests: store-wide retrieval, category-scoped, custom limit, fewer than limit, empty store, expired filtering, stale index entries (missing `updatedAt`)

## 5. Update `listMemories` — Surface `updatedAt`

- [x] 5.1 Add `updatedAt` to `ListedMemory` type in `packages/core/src/memory/operations.ts`
- [x] 5.2 Update `listMemories` to populate `updatedAt` from index entries
- [x] 5.3 Update `listMemoriesHandler` in `packages/server/src/memory/tools.ts` to include `updated_at` in response
- [x] 5.4 Add test for `list_memories` response containing `updated_at`

## 6. MCP tool — `cortex_get_recent_memories`

- [x] 6.1 Define Zod input schema for `cortex_get_recent_memories` (store, category?, limit?, include_expired?)
- [x] 6.2 Implement `getRecentMemoriesHandler` in `packages/server/src/memory/tools.ts`
- [x] 6.3 Register `cortex_get_recent_memories` tool on the MCP server
- [x] 6.4 Add tests for the MCP tool handler (success, empty, error cases)

## 7. Verification

- [x] 7.1 Run full test suite (`bun test packages`)
- [x] 7.2 Run type check (`bunx tsc --build`)
- [x] 7.3 Run linter (`bunx eslint packages/*/src/**/*.ts --fix`)
