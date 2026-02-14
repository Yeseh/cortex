---
created_at: 2026-02-14T17:59:09.372Z
updated_at: 2026-02-14T17:59:09.372Z
tags: []
source: mcp
citations:
  - openspec/project.md
---
Title: Merge categories/indexes in core library
Why: Categories and indexes in the core domain are overlapping concepts causing conceptual confusion and duplicated code; consolidating will simplify the API and reduce maintenance burden.
Goal: Create a single, cohesive abstraction in @yeseh/cortex-core that represents category/index responsibilities and provide a migration path for adapters.
Tasks:
- Audit current usage: list all core types, functions, and storage ports referencing categories or indexes
- Design: propose new unified interface and rename plan (non-breaking facade where possible)
- Implement: refactor core modules to use unified abstraction, add adapters for backward compatibility
- Tests: update and add unit tests covering previous category/index behaviors and migration scenarios
- Docs: update docs, migration notes, and changelog
Risks & Notes:
- This is a breaking change if public APIs are renamed — prefer facade + deprecation cycle
- Coordinate with storage-fs and server packages before merging
Tags: [core, architecture, todo]