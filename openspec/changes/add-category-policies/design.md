# Design: Category Policies

## Context

Cortex stores memories in a category hierarchy. Currently the only governance knob is `categoryMode` at the store level, which is too coarse: it can't differ by category, and it only controls structure (free/subcategories/strict), not lifecycle or permissions.

The brainstorm (`docs/brainstorms/2026-02-26-category-policies-brainstorm.md`) established a detailed design. This document formalises the key technical decisions for implementation.

**Stakeholders:** AI agents (primary consumers of errors), human operators (write config).

**Constraints:**

- No disk I/O during policy resolution — config is already loaded into memory
- Policy errors must be agent-friendly (what went wrong + what to do)
- `categoryMode` is removed with no deprecation path (breaking change, explicit in proposal)

## Goals / Non-Goals

**Goals:**

- Per-category configurable policies: TTL ceiling, content length limit, create/update/delete permissions, subcategory creation toggle
- Inheritable policies: child overrides parent; unset fields inherit from nearest ancestor or system defaults
- Two separate pipelines: validation (pure checks) and transformation (input mutation)
- Composable: memory and category operations each compose the relevant validators/transformers

**Non-Goals (deferred):**

- Auto-tags / auto-citations / required metadata fields / token budgets
- Read permission (excluded by design — access control is at the store level)
- Deprecation/migration path for `categoryMode` (hard breaking change)

## Decisions

### Decision: New `policy/` module owns all policy concerns

A dedicated `packages/core/src/policy/` module owns types, resolution, validators, transformers, and pipeline runner. The `memory/` and `category/` modules compose from it but the policy module has no knowledge of either.

**Why:** Clear ownership boundary; policy logic is independently testable; avoids coupling resolution to operation types.

**Alternatives considered:**

- Inline validators in each operation — makes reuse harder and scatters policy logic
- Single `policies.ts` file — becomes large; brainstorm explicitly calls for per-concern files

### Decision: `EffectivePolicy` as the resolved value type

After walking the category hierarchy, a single `EffectivePolicy` object is produced with all fields fully resolved (no optional fields except `defaultTtl` and `maxContentLength` which are truly optional constraints):

```typescript
type EffectivePolicy = {
    defaultTtl?: number; // days — undefined means no ceiling
    maxContentLength?: number; // chars — undefined means no limit
    permissions: {
        create: boolean; // default: true
        update: boolean; // default: true
        delete: boolean; // default: true
    };
    subcategoryCreation: boolean; // default: true
};
```

**Why:** Consumers don't need to understand inheritance; they receive a flat resolved value.

### Decision: Child-overrides-parent inheritance with system defaults as floor

Walk from target category up to root, collecting policy fragments. Merge from root downward: child fields win. Unset fields fall back to system defaults (all allowed, no limits).

**Why:** Most intuitive mental model; matches how CSS cascade and RBAC inheritance work.

### Decision: `defaultTtl` is a silent transformation, not a validation error

When a memory's expiry exceeds `defaultTtl`, the expiry is silently reduced to `defaultTtl`. When no expiry is set, `defaultTtl` is applied as the expiry.

**Why:** Agents frequently forget to set expiry on short-lived memories. Silent enforcement ensures hygiene without breaking agent flows. Explicit violations (content too long, permission denied) remain hard errors.

### Decision: `update: false` also governs `setDescription`

The `permissions.update` flag applies to both `updateMemory` and `setDescription` category operations.

**Why:** A read-only category (e.g., `standards`) should not allow description tampering either.

### Decision: `permissions` supports partial declaration in config

In the YAML config, operators can write `permissions: { delete: false }` and unspecified fields default to `true`. The parser fills in defaults at load time.

**Why:** Reduces config verbosity; operators only declare constraints, not permissions.

## Architecture: Module Structure

```
packages/core/src/
├── policy/
│   ├── types.ts               # EffectivePolicy, PolicyValidator, PolicyTransformer, PolicyError
│   ├── operations/
│   │   ├── resolve.ts         # resolveEffectivePolicy(store, categoryPath) → EffectivePolicy
│   │   └── resolve.spec.ts
│   ├── validators/
│   │   ├── permissions.ts     # checkCreatePermission, checkUpdatePermission, checkDeletePermission
│   │   ├── content-length.ts  # validateMaxContentLength
│   │   ├── subcategory.ts     # validateSubcategoryCreation
│   │   └── *.spec.ts
│   ├── transformers/
│   │   ├── ttl.ts             # applyDefaultTtl
│   │   └── *.spec.ts
│   └── runner.ts              # runValidation(), runTransformation()
├── memory/operations/
│   ├── create.ts   # [checkCreatePermission, validateMaxContentLength] + [applyDefaultTtl]
│   ├── update.ts   # [checkUpdatePermission, validateMaxContentLength]
│   └── delete.ts   # [checkDeletePermission]
└── category/operations/
    ├── create.ts          # [validateSubcategoryCreation]
    ├── delete.ts          # [checkDeletePermission]
    └── set-description.ts # [checkUpdatePermission]
```

## Key Interfaces

```typescript
type PolicyValidator<TInput> = (
    policy: EffectivePolicy,
    input: TInput
) => Result<void, PolicyError>;

type PolicyTransformer<TInput> = (policy: EffectivePolicy, input: TInput) => TInput;

type PolicyError = {
    code: 'OPERATION_NOT_PERMITTED' | 'CONTENT_TOO_LONG' | 'SUBCATEGORY_CREATION_NOT_ALLOWED';
    message: string; // agent-friendly: what went wrong + what to do
};
```

## Pipeline Execution Flow

```
Request → Handler
  → resolveEffectivePolicy(store, categoryPath)
  → runValidation(validators, policy, input)
      → Fail: return PolicyError
      → Pass: runTransformation(transformers, policy, input)
                → Core operation(transformedInput)
```

## Config Schema Change

Category definitions in `stores.yaml` gain an optional `policies` block. `categoryMode` is removed:

```yaml
# BEFORE
stores:
    cortex:
        categoryMode: strict

# AFTER
stores:
    cortex:
        categories:
            standards:
                policies:
                    permissions: { update: false, delete: false }
                    subcategoryCreation: false
```

## Risks / Trade-offs

- **Breaking change**: Any config using `categoryMode` will fail to parse after this change. Risk is low since the feature was primarily designed but not yet widely deployed.
- **Silent TTL enforcement**: Agents may not know their expiry was reduced. Acceptable per design (hygiene enforcement), but implementers should log at debug level.
- **Inheritance complexity**: Deep hierarchies could have surprising effective policies. Mitigated by clear documentation and agent-friendly error messages pointing to config.

## Migration Plan

1. Remove `categoryMode` from config schema and parsing
2. Implement `policy/` module with types, resolution, validators, transformers, runner
3. Update `memory/` operations to compose policy pipeline
4. Update `category/` operations to compose policy pipeline
5. Update config spec and tests
6. No data migration needed (policy is config-only, not persisted with memories)

## Open Questions

- None blocking initial scope. Deferred items (auto-tags, token budgets, etc.) are captured in the brainstorm doc.
