---
created_at: 2026-01-27T20:21:15.834Z
updated_at: 2026-01-27T20:21:15.834Z
tags: [checklist, module, quick-reference]
source: mcp
---
When creating a new business logic module in Cortex:

- [ ] Create `types.ts` with port interface, error codes (discriminated union), and result types
- [ ] Create `operations.ts` with pure functions that take port as first param
- [ ] Add comprehensive JSDoc with `@module`, `@example`, edge case docs
- [ ] All fallible operations return `Result<T, E>`, never throw
- [ ] **Error messages include actionable guidance** - suggest how to fix/mitigate the issue
- [ ] Create `operations.spec.ts` with mock factory and describe blocks
- [ ] Create `index.ts` barrel with explicit type/value exports
- [ ] Follow idempotency patterns (create returns `created: false`, delete errors on missing)
- [ ] Document MAX_* constants with rationale in JSDoc