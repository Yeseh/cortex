---
created_at: 2026-02-05T19:13:02.905Z
updated_at: 2026-02-05T19:13:02.905Z
tags:
  - map
  - core
  - domain
source: mcp
---
# Core Package (@yeseh/cortex-core)

**Path**: packages/core
**Purpose**: Core domain logic, types, and validation - the heart of the system

## Domain Modules
- `memory/` - Memory types, creation, validation
- `category/` - Category management and hierarchy
- `store/` - Store registry and multi-store support
- `index/` - Index types for memory organization
- `storage/` - Storage adapter interfaces (ports)

## Exports
- Main: ./src/index.ts
- Subpath exports for each domain: /memory, /category, /store, /index, /storage

## Dependencies
- yaml: YAML parsing for memory frontmatter
- zod: Schema validation
- @toon-format/toon: Text format parsing