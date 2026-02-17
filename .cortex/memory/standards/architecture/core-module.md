---
{created_at: 2026-02-17T19:14:27.818Z,updated_at: 2026-02-17T19:14:27.818Z,tags: [standard,architecture,core,module-structure],source: mcp}
---
# Core Module Pattern

## Overview
Core modules follow ports-and-adapters: core owns business logic and types, entrypoints stay thin, and storage implementations live outside core. Avoid filesystem or transport details in core; keep core reusable via abstract interfaces.

## File Structure
Core module layout should be predictable:
- `types.ts` - errors, ports, result types
- `operations.ts` - business logic
- `index.ts` - selective exports
- `*.spec.ts` - colocated test files

## Scaling
When a core module grows large, split operations into per-operation files (`create.ts`, `delete.ts`, `set-description.ts`) with matching spec files and re-export them from the module index. Keep each file focused and under a few hundred lines.

## References
- `packages/core/src/<module>/types.ts`
- `packages/core/src/<module>/operations.ts`
- `packages/core/src/<module>/index.ts`
- `standards/entrypoints/*` for wrapper patterns