---
created_at: 2026-02-13T19:52:48.667Z
updated_at: 2026-02-13T19:52:48.667Z
tags: []
source: mcp
---
Core modules follow ports-and-adapters: core owns business logic and types, entrypoints stay thin, and storage implementations live outside core. Avoid filesystem or transport details in core; keep core reusable via abstract interfaces. References: packages/core/src/, standards/entrypoints/* for wrapper patterns.