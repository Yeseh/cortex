---
created_at: 2026-02-26T19:40:49.916Z
updated_at: 2026-02-26T19:40:49.916Z
tags:
    - feature
    - category
    - policies
    - governance
    - breaking-change
source: mcp
citations:
    - docs/brainstorms/2026-02-26-category-policies-brainstorm.md
---

# Feature: Category Policies

## Status

Brainstorm Complete (2026-02-26)

## Summary

Category-level policy system that enforces rules on memories and subcategories. Replaces store-level `categoryMode` and the superseded store-guardrails concept. Categories are the governance boundary; stores only determine storage.

## Key Design Decisions

### Breaking Change

- `categoryMode` on stores is removed, absorbed into per-category `subcategoryCreation` policy

### Policy Set (Initial)

- `defaultTtl` (number, days) — ceiling on memory expiry, `min(explicit, default)` semantics
- `maxContentLength` (number, characters) — max memory content length
- `permissions.create` / `permissions.update` / `permissions.delete` (booleans, default `true`) — partial declaration supported
- `subcategoryCreation` (boolean, default `true`)
- No read permission (excluded by design)
- `update: false` also prevents `setDescription`

### Inheritance

- Child overrides parent, unset fields inherit from nearest ancestor
- Categories not in config get system defaults (everything allowed)

### Architecture

- **Two pipelines**: validation (pure checks) and transformation (input mutation), separated for maintainability
- **`policy/` module**: owns validators, transformers, runner functions, resolution logic
- **`memory/` and `category/` modules**: compose pipelines per operation type
- Policy resolution walks in-memory store config (no disk I/O)
- Agent-friendly errors: what went wrong + what to do about it

## Config Example

```yaml
categories:
    standup:
        policies:
            defaultTtl: 7
            maxContentLength: 5000
            permissions: { delete: false }
    standards:
        policies:
            permissions: { update: false, delete: false }
            subcategoryCreation: false
```

## References

- `docs/brainstorms/2026-02-26-category-policies-brainstorm.md` — full brainstorm session
- Supersedes: `features/store-guardrails`
