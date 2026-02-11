---
created_at: 2026-02-11T20:21:29.304Z
updated_at: 2026-02-11T20:21:29.304Z
tags:
  - standards
  - api
  - update
  - semantics
source: mcp
---
# Update Semantics: Overwrite, Not Merge

When updating resources (memories, categories, etc.), fields use **overwrite semantics**:

- **Provided**: replaces the existing value entirely (e.g., `tags: ["new"]` replaces all previous tags)
- **Omitted**: preserves the existing value untouched
- **Empty value** (e.g., `[]`): clears the field

This applies to all array and optional fields on update operations (`tags`, `citations`, `expires_at`). There should be no separate "clear" boolean flags — passing the empty/null representation of the type is sufficient to clear.

Do not use merge semantics (e.g., appending to arrays) unless explicitly documented as such.