---
created_at: 2026-01-29T21:07:40.788Z
updated_at: 2026-01-29T21:07:40.788Z
tags:
  - cli
  - memory
  - list
  - bugfix
source: flag
---
# Dynamic Root Category Discovery

## Context
The `memory list` command without a category argument was returning empty results for stores that didn't use the hardcoded category names (`human`, `persona`, `project`, `domain`).

## Decision
Changed `collectAllCategories()` in `src/cli/commands/memory/list/command.ts` to dynamically read the root index file and discover categories from `subcategories` field.

## Rationale
- Stores can organize memories under any top-level category structure
- No assumption about category naming conventions
- Root index is the source of truth for store structure

## Implementation
1. Load root index via `loadCategoryIndex(adapter, '')`
2. Collect memories directly in root (if any)
3. Iterate over `rootIndex.subcategories` to collect from discovered categories