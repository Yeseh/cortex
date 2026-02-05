---
created_at: 2026-02-05T19:15:56.049Z
updated_at: 2026-02-05T19:15:56.049Z
tags:
  - map
  - storage-fs
  - concepts
  - filesystem
source: mcp
---
# Storage-FS Package Key Concepts

## File Formats
- **Memory files**: YAML frontmatter + markdown content
  - Fields: created_at, updated_at, tags, source, expires_at (optional)
  - File extension: .md (configurable)
  - Case conversion: snake_case (file) ↔ camelCase (API)

- **Index files**: YAML format (index.yaml)
  - Location: root and each category directory
  - Contains: memories[] and subcategories[]

- **Registry file**: stores.yaml
  - Maps store names to filesystem paths
  - Location: ~/.config/cortex/stores.yaml

## ISP Implementation
- FilesystemMemoryStorage → implements MemoryStorage
- FilesystemIndexStorage → implements IndexStorage
- FilesystemCategoryStorage → implements CategoryStorage
- FilesystemRegistry → implements Registry

## Context Sharing
- FilesystemContext: storeRoot, memoryExtension, indexExtension
- Shared across all storage classes via constructor injection

## Index Management
- Incremental updates on memory write
- Token estimation using defaultTokenizer
- Collision handling with numeric suffixes (-2, -3)
- Full reindexing capability