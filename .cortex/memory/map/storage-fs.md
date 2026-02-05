---
created_at: 2026-02-05T19:13:06.556Z
updated_at: 2026-02-05T19:13:06.556Z
tags:
  - map
  - storage
  - filesystem
source: mcp
---
# Storage FS Package (@yeseh/cortex-storage-fs)

**Path**: packages/storage-fs
**Purpose**: Filesystem-based storage adapter implementing core storage interfaces

## Responsibilities
- Memory persistence to disk (YAML frontmatter + markdown)
- Category hierarchy management on filesystem
- Index file management (category indexes)
- Store registry persistence

## Key Components
- FilesystemStorageAdapter: Main adapter implementing storage interfaces
- Memory storage: Read/write memory files
- Category storage: Manage category directories
- Index storage: Manage index.yaml files

## File Format
- Memories: YAML frontmatter + markdown content
- Indexes: index.yaml files in category directories