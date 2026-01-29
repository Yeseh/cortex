---
created_at: 2026-01-28T18:56:01.171Z
updated_at: 2026-01-28T18:56:01.171Z
tags: [policy, tests, workflow, critical]
source: mcp
---
# Handling Pre-existing Test Failures

## Rule
When encountering pre-existing test failures during implementation work, you MUST NOT ignore them or mark them as "unrelated". Instead:

1. **Dispatch a subagent** to debug and fix the failing tests
2. **Do not proceed** with archiving or completing proposals until the test suite is green
3. **Create a task** in the implementation plan to address test failures if discovered

## Rationale
- Pre-existing test failures indicate technical debt that compounds over time
- A green test suite is required for confident releases
- Fixing tests while context is fresh is more efficient than deferring

## Action Pattern
```
When tests fail:
1. Analyze which tests are failing and why
2. Dispatch code-implementer subagent with specific fix instructions
3. Verify fixes pass before continuing
4. If fixes are complex, create a separate change proposal
```

## Reference
This rule was established after the refactor-filesystem-storage implementation (2026-01-28) where pre-existing test failures were identified but deferred.