---
{created_at: 2026-02-05T19:15:50.362Z,updated_at: 2026-02-17T19:15:23.890Z,tags: [map,core,concepts,domain,operations],source: mcp}
---
# Core Package Key Concepts

## Domain Types
- **Memory**: `{ metadata: MemoryMetadata, content: string }` - A stored piece of knowledge
- **MemoryMetadata**: createdAt, updatedAt, tags[], source, expiresAt?
- **Category**: Hierarchical container for memories, supports nesting
- **Store**: A complete memory storage location (StoreDefinition, StoreRegistry)
- **CategoryIndex**: Tracks memories and subcategories for efficient traversal

## Identity Types
- **MemorySlug**: Single lowercase hyphenated identifier segment
- **MemoryCategoryPath**: Array of slug segments
- **MemorySlugPath**: Full path string (`category/subcategory/memory-name`)
- **MemoryIdentity**: Parsed identity with slugPath, categories[], slug

## Storage Interfaces (Ports)
- **MemoryStorage**: read, write, remove, move
- **IndexStorage**: read, write, reindex, updateAfterMemoryWrite
- **CategoryStorage**: categoryExists, readCategoryIndex, writeCategoryIndex
- **StoreStorage**: load, save, remove
- **ScopedStorageAdapter**: Composed adapter with memories, indexes, categories properties
- **Registry**: Store factory pattern with initialize(), load(), save(), getStore()

## Root Categories
- Protected categories: `human`, `persona`
- Cannot be deleted or have descriptions set

## Domain Operations
Core memory operations in `packages/core/src/memory/operations.ts`:
- createMemory, getMemory, updateMemory, moveMemory, removeMemory
- listMemories, pruneExpiredMemories (supports dryRun option)

MCP tools and CLI commands should delegate to these core operations.