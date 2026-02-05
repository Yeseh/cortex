---
created_at: 2026-02-05T19:15:18.226Z
updated_at: 2026-02-05T19:15:18.226Z
tags:
  - map
  - core
  - files
source: mcp
---
# Core Package Key Files

## Root Level (`packages/core/src/`)
- `index.ts` - Main barrel export
- `types.ts` - Core domain types: Result<T,E>, MemorySlug, MemorySlugPath, MemoryIdentity
- `result.ts` - Result type helpers: ok(), err()
- `slug.ts` - Slug validation: isValidMemorySlug(), toSlug(), buildMemorySlugPath()
- `tokens.ts` - Token estimation: Tokenizer interface, defaultTokenizer
- `config.ts` - Config loading: loadConfig(), parseConfig()
- `serialization.ts` - Serialization: serialize(), deserialize(), parseIndex(), serializeIndex()

## Memory Module (`memory/`)
- `types.ts` - Memory, MemoryMetadata, MemoryError, MemoryErrorCode
- `operations.ts` - createMemory(), getMemory(), updateMemory(), moveMemory(), removeMemory(), listMemories(), pruneExpiredMemories()
- `validation.ts` - validateCategoryPath(), validateMemorySlugPath()
- `expiration.ts` - isExpired(), isExpiredNow()

## Category Module (`category/`)
- `types.ts` - CategoryError, CategoryStorage port, ROOT_CATEGORIES
- `operations.ts` - createCategory(), setDescription(), deleteCategory(), getAncestorPaths()

## Store Module (`store/`)
- `registry.ts` - StoreRegistry, parseStoreRegistry(), isValidStoreName()
- `operations.ts` - initializeStore()
- `store.ts` - resolveStore()

## Storage Module (`storage/`)
- `adapter.ts` - MemoryStorage, IndexStorage, CategoryStorage, StoreStorage, ScopedStorageAdapter, Registry interfaces