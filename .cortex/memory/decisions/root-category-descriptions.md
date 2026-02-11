---
created_at: 2026-01-29T21:07:46.931Z
updated_at: 2026-01-29T21:07:46.931Z
source: mcp
tags:
    - category
    - description
    - root-category
    - mcp
---

# Root Category Descriptions Allowed

## Decision

Root categories (single-segment paths like `project`, `human`, `persona`) can now have descriptions set via the `cortex_set_category_description` MCP tool.

## Context

Previously, the `setDescription` function in `core/category/operations.ts` explicitly rejected root categories with a `ROOT_CATEGORY_REJECTED` error. This was an intentional design decision documented in `core/category/types.ts`.

## Change

Removed the `isRootCategory` check from `setDescription` to allow descriptions on any category level.

## Implementation Details

- Root category descriptions are stored in the store's root `index.yaml` file (empty parent path)
- The storage layer (`updateSubcategoryDescription`) already supported this - only the business logic blocked it
- Delete operations still reject root categories (cannot delete `project`, `human`, etc.)

## Files Changed

- `packages/core/src/category/operations.ts` - Removed root category rejection
- `packages/core/src/category/types.ts` - Updated documentation
- `packages/server/src/category/tools.ts` - Removed error handler, updated docstring
- Test files updated to expect success instead of rejection
