# Category Policies Brainstorm

**Date:** 2026-02-26
**Supersedes:** `features/store-guardrails` (store-level guardrails)

## Summary

Category policies are a governance system that attaches configurable rules to categories in the Cortex hierarchy. Policies control memory lifecycle (auto-expiry, content limits), permissions (create/update/delete), and structural rules (subcategory creation). This replaces the original "store-specific guardrails" concept and absorbs the existing `categoryMode` feature.

## Core Design Decisions

### Stores vs Categories

- **Stores** determine _how_ and _where_ things are stored (filesystem adapter, path, kind)
- **Categories** determine _what rules apply_ to memories living under them
- Policies live at the **category level**, not the store level

### `categoryMode` Absorbed

The existing `categoryMode` (`free`, `subcategories`, `strict`) is replaced by category-level policies. The `subcategoryCreation` boolean policy replaces the mode system entirely. This is a **breaking change** — no deprecation path needed.

### Policy Set (Initial Scope)

| Policy                | Type                  | Default                 | Description                                                              |
| --------------------- | --------------------- | ----------------------- | ------------------------------------------------------------------------ |
| `defaultTtl`          | `number` (days)       | `undefined` (no expiry) | Maximum TTL ceiling for memories. `min(explicit, default)` semantics.    |
| `maxContentLength`    | `number` (characters) | `undefined` (no limit)  | Maximum memory content length in characters.                             |
| `permissions.create`  | `boolean`             | `true`                  | Whether new memories can be created.                                     |
| `permissions.update`  | `boolean`             | `true`                  | Whether existing memories can be updated. Also governs `setDescription`. |
| `permissions.delete`  | `boolean`             | `true`                  | Whether memories can be deleted.                                         |
| `subcategoryCreation` | `boolean`             | `true`                  | Whether new subcategories can be created under this category.            |

### No Read Permission

Read permissions were explicitly excluded. If agents shouldn't read something, it shouldn't be in a store they have access to.

## Policy Inheritance

Policies follow the category hierarchy with **child-overrides-parent** semantics:

1. Walk up from the target category to the root
2. Merge policies: child fields override parent fields
3. Unset fields at every level fall back to **system defaults** (everything allowed, no constraints)

### Example

```yaml
categories:
    standup:
        policies:
            defaultTtl: 7
            maxContentLength: 5000
            permissions:
                delete: true
            subcategoryCreation: true
        subcategories:
            pinned:
                policies:
                    defaultTtl: 30
```

Effective policy for `/standup/pinned`:

- `defaultTtl: 30` (overridden by child)
- `maxContentLength: 5000` (inherited from parent)
- `permissions`: all `true` (inherited/defaults)
- `subcategoryCreation: true` (inherited from parent)

### Categories Not in Config

Categories not defined in config have no policies — system defaults apply (everything allowed, no constraints).

## `defaultTtl` Semantics

The `defaultTtl` acts as a **ceiling** using `min(explicit, default)`:

- Agent sets no expiry → pipeline applies `defaultTtl` as the expiry
- Agent sets expiry < `defaultTtl` → agent's value is used
- Agent sets expiry > `defaultTtl` → `defaultTtl` is enforced

Motivation: Agents frequently forget to set expiry on short-lived memories. This ensures categories like `/standup` and `/investigations` have enforced memory hygiene.

## Architecture

### Two Separate Pipelines

1. **Validation pipeline** — checks constraints, returns pass/fail with agent-friendly errors. Pure predicates, no mutation.
2. **Transformation pipeline** — enriches/mutates input data (e.g., applying default TTL). Runs after validation passes.

Separated for clean interfaces and maintainability.

### Module Structure

```
packages/core/src/
├── policy/                    # NEW: Policy module
│   ├── types.ts               # EffectivePolicy, PolicyValidator, PolicyTransformer, PolicyError
│   ├── operations/
│   │   ├── resolve.ts         # resolveEffectivePolicy(store, categoryPath) → EffectivePolicy
│   │   └── resolve.spec.ts
│   ├── validators/            # Individual policy validators
│   │   ├── permissions.ts     # checkCreatePermission, checkUpdatePermission, checkDeletePermission
│   │   ├── content-length.ts  # validateMaxContentLength
│   │   ├── subcategory.ts     # validateSubcategoryCreation
│   │   └── *.spec.ts
│   ├── transformers/          # Individual policy transformers
│   │   ├── ttl.ts             # applyDefaultTtl
│   │   └── *.spec.ts
│   └── runner.ts              # runValidation(), runTransformation()
├── memory/
│   └── operations/
│       ├── create.ts          # Composes: [checkCreatePermission, validateMaxContentLength] + [applyDefaultTtl]
│       ├── update.ts          # Composes: [checkUpdatePermission, validateMaxContentLength]
│       ├── delete.ts          # Composes: [checkDeletePermission]
│       └── ...
├── category/
│   └── operations/
│       ├── create.ts          # Composes: [validateSubcategoryCreation]
│       ├── delete.ts          # Composes: [checkDeletePermission]
│       ├── set-description.ts # Composes: [checkUpdatePermission]
│       └── ...
```

### Responsibility Boundaries

- **`policy/`** — owns individual validators, transformers, runner functions, types, and the resolution logic
- **`memory/`** — composes the relevant policy validators/transformers for memory operations
- **`category/`** — composes the relevant policy validators/transformers for category operations
- **Policy module does NOT know about memory or category operations** — it provides building blocks only

### Key Interfaces

```typescript
// Resolved effective policy for a category
type EffectivePolicy = {
    defaultTtl?: number; // days
    maxContentLength?: number; // characters
    permissions: {
        create: boolean; // default: true
        update: boolean; // default: true
        delete: boolean; // default: true
    };
    subcategoryCreation: boolean; // default: true
};

// Validation: pure check, no mutation
type PolicyValidator<TInput> = (
    policy: EffectivePolicy,
    input: TInput
) => Result<void, PolicyError>;

// Transformation: returns modified input
type PolicyTransformer<TInput> = (policy: EffectivePolicy, input: TInput) => TInput;
```

### Policy Resolution

`resolveEffectivePolicy(store: Store, categoryPath: CategoryPath)` walks the in-memory store config (already loaded into `CortexContext.stores`) up the category hierarchy, merging policies. No disk I/O needed — purely an in-memory tree walk.

### Pipeline Execution Flow

```
Request → Handler → resolveEffectivePolicy()
                  → runValidation(validators, policy, input)
                      → Pass: runTransformation(transformers, policy, input)
                          → Core operation(transformedInput)
                      → Fail: Return PolicyError with agent-friendly message
```

## Config Schema

```yaml
stores:
    cortex:
        kind: filesystem
        properties:
            path: /home/jesse/.cortex
        categories:
            standup:
                description: 'Daily standup summaries'
                policies:
                    defaultTtl: 7
                    maxContentLength: 5000
                    permissions:
                        delete: false
                    subcategoryCreation: true
                subcategories:
                    pinned:
                        policies:
                            defaultTtl: 30
            standards:
                description: 'Coding standards'
                policies:
                    permissions:
                        update: false
                        delete: false
                    subcategoryCreation: false
            investigations:
                description: 'Temporary research'
                policies:
                    defaultTtl: 14
```

- `permissions` supports partial declaration — unset fields default to `true`
- All policy fields are optional — only declare what you want to constrain
- `defaultTtl` is a number (days), no string parsing

## Agent-Friendly Error Messages

Errors must include: **what went wrong + what to do about it**.

Examples:

```
Error: CONTENT_TOO_LONG
"Memory content exceeds the maximum length of 5000 characters for category '/standup'.
Current length: 7234 characters. Reduce the content or split into multiple memories."

Error: OPERATION_NOT_PERMITTED
"Delete operations are not allowed on memories in category '/standards'.
This category is configured with delete permission disabled.
To modify this policy, update the category configuration in config.yaml."

Error: SUBCATEGORY_CREATION_NOT_ALLOWED
"Cannot create subcategory under '/standards'.
Subcategory creation is disabled for this category.
To modify this policy, update the category configuration in config.yaml."

Error: TTL_EXCEEDS_MAXIMUM
"Memory expiry of 30 days exceeds the maximum TTL of 14 days for category '/investigations'.
The expiry was reduced to 14 days. No action needed."
```

Note: The TTL case is a transformation, not a validation error — it silently enforces the ceiling. The message above would be informational/logged, not an error.

## Operation-to-Policy Mapping

| Operation        | Validators                                          | Transformers      |
| ---------------- | --------------------------------------------------- | ----------------- |
| `createMemory`   | `checkCreatePermission`, `validateMaxContentLength` | `applyDefaultTtl` |
| `updateMemory`   | `checkUpdatePermission`, `validateMaxContentLength` | —                 |
| `deleteMemory`   | `checkDeletePermission`                             | —                 |
| `createCategory` | `validateSubcategoryCreation`                       | —                 |
| `deleteCategory` | `checkDeletePermission`                             | —                 |
| `setDescription` | `checkUpdatePermission`                             | —                 |

## Open Questions / Future Work

- **Auto-tags** — apply tags automatically based on category (deferred from initial scope)
- **Auto-citations** — auto-attach source citations (deferred)
- **Required metadata fields** — enforce that certain fields are populated (deferred)
- **Token budget limits** — per-category token budgets (deferred)
- **Default source attribution** — auto-set source field (deferred)
