---
created_at: 2026-02-13T19:52:48.697Z
updated_at: 2026-02-13T19:52:48.697Z
tags: []
source: mcp
---
Core module layout should be predictable: types.ts for errors/ports/result types, operations.ts for business logic, index.ts for selective exports, and spec files colocated. References: packages/core/src/<module>/types.ts, packages/core/src/<module>/operations.ts, packages/core/src/<module>/index.ts.