---
created_at: 2026-01-29T21:07:46.931Z
updated_at: 2026-01-29T21:07:46.931Z
tags:
  - reindex
  - bugfix
  - indexes
source: flag
---
# Reindex Root Subcategory Recording

## Context
The `store reindex` command was not creating a root index.yaml when a store only had 2-segment paths (e.g., `standards/typescript`). This caused `memory list` to return empty results.

## Decision
Fixed `recordParentSubcategory()` in `src/core/storage/filesystem/indexes.ts` to record root → first-level category relationships for all paths with 2+ segments.

## Previous Behavior
Only recorded relationships for paths with 3+ segments:
```typescript
if (segments.length <= 2) return;  // Skipped 2-segment paths
```

## New Behavior
Records root relationship for all valid paths:
```typescript
// Record root -> first category relationship
const firstCategory = segments[0];
if (firstCategory) {
    const rootSubcategories = parentSubcategories.get('') ?? new Set();
    rootSubcategories.add(firstCategory);
    parentSubcategories.set('', rootSubcategories);
}
```

## Impact
- Root index.yaml is now created with proper subcategories list
- `memory list` works correctly for all store structures