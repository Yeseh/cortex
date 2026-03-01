## ADDED Requirements

### Requirement: EffectivePolicy type

The policy module SHALL define an `EffectivePolicy` type representing the fully resolved policy for a category, with all inheritance applied and system defaults filled in.

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

#### Scenario: System default effective policy

- **WHEN** a category has no policies configured at any level of its ancestry
- **THEN** the resolved `EffectivePolicy` has `permissions.create`, `permissions.update`, `permissions.delete`, and `subcategoryCreation` all equal to `true`
- **AND** `defaultTtl` and `maxContentLength` are `undefined`

#### Scenario: Partially configured effective policy

- **WHEN** a category configures only `permissions.delete: false`
- **THEN** the resolved `EffectivePolicy` has `permissions.delete: false`
- **AND** all other fields are system defaults

### Requirement: Policy resolution

The policy module SHALL provide a `resolveEffectivePolicy(store, categoryPath)` function that walks the store's in-memory category config up from the target category to the root, merging policy fragments with child-overrides-parent semantics. No disk I/O is performed.

#### Scenario: Direct policy resolution

- **WHEN** a category defines `policies: { defaultTtl: 7 }`
- **AND** `resolveEffectivePolicy` is called for that category
- **THEN** the resolved policy has `defaultTtl: 7`

#### Scenario: Inherited policy from parent

- **WHEN** a parent category defines `policies: { maxContentLength: 5000 }`
- **AND** a child category defines no policies
- **THEN** `resolveEffectivePolicy` for the child returns `maxContentLength: 5000`

#### Scenario: Child overrides parent

- **WHEN** a parent category defines `policies: { defaultTtl: 30 }`
- **AND** a child category defines `policies: { defaultTtl: 7 }`
- **THEN** `resolveEffectivePolicy` for the child returns `defaultTtl: 7`

#### Scenario: Child inherits unset fields from parent

- **WHEN** a parent category defines `policies: { defaultTtl: 30, maxContentLength: 5000 }`
- **AND** a child category defines `policies: { defaultTtl: 7 }`
- **THEN** `resolveEffectivePolicy` for the child returns `defaultTtl: 7` and `maxContentLength: 5000`

#### Scenario: Category not in config uses system defaults

- **WHEN** a category path has no config entry at any ancestor level
- **THEN** `resolveEffectivePolicy` returns the system default policy (all allowed, no limits)

#### Scenario: Permissions partial declaration resolved correctly

- **WHEN** a category defines `policies: { permissions: { delete: false } }`
- **THEN** `resolveEffectivePolicy` returns `permissions: { create: true, update: true, delete: false }`

### Requirement: Policy validators

The policy module SHALL provide pure validator functions that check a constraint in an `EffectivePolicy` against input data and return a `Result<void, PolicyError>`.

The following validators SHALL be provided:

- `checkCreatePermission(policy, input)` — fails with `OPERATION_NOT_PERMITTED` if `permissions.create` is `false`
- `checkUpdatePermission(policy, input)` — fails with `OPERATION_NOT_PERMITTED` if `permissions.update` is `false`
- `checkDeletePermission(policy, input)` — fails with `OPERATION_NOT_PERMITTED` if `permissions.delete` is `false`
- `validateMaxContentLength(policy, input)` — fails with `CONTENT_TOO_LONG` if `maxContentLength` is set and content exceeds it
- `validateSubcategoryCreation(policy, input)` — fails with `SUBCATEGORY_CREATION_NOT_ALLOWED` if `subcategoryCreation` is `false`

All validator errors MUST include agent-friendly messages: what went wrong and what the agent should do.

#### Scenario: Create permission check passes

- **WHEN** `checkCreatePermission` is called with a policy where `permissions.create: true`
- **THEN** it returns `Result.ok(undefined)`

#### Scenario: Create permission check fails

- **WHEN** `checkCreatePermission` is called with a policy where `permissions.create: false`
- **THEN** it returns an error with code `OPERATION_NOT_PERMITTED`
- **AND** the error message names the blocked operation and references the config

#### Scenario: Content length check passes

- **WHEN** `validateMaxContentLength` is called with content within the limit
- **THEN** it returns `Result.ok(undefined)`

#### Scenario: Content length check fails

- **WHEN** `validateMaxContentLength` is called with content exceeding the limit
- **THEN** it returns an error with code `CONTENT_TOO_LONG`
- **AND** the error message states the limit, the actual content length, and suggests splitting or reducing

#### Scenario: Content length check skipped when not configured

- **WHEN** `validateMaxContentLength` is called with a policy where `maxContentLength` is `undefined`
- **THEN** it returns `Result.ok(undefined)` regardless of content length

#### Scenario: Subcategory creation check fails

- **WHEN** `validateSubcategoryCreation` is called with a policy where `subcategoryCreation: false`
- **THEN** it returns an error with code `SUBCATEGORY_CREATION_NOT_ALLOWED`
- **AND** the error message names the parent category and references the config

### Requirement: Policy transformer — applyDefaultTtl

The policy module SHALL provide an `applyDefaultTtl(policy, input)` transformer that enforces the `defaultTtl` ceiling on memory expiry. It returns the (possibly mutated) input; it does not return an error.

- If `defaultTtl` is not set in policy → input is returned unchanged
- If `expiresAt` is not set in input → `expiresAt` is set to `now + defaultTtl days`
- If `expiresAt` is set and exceeds the ceiling → `expiresAt` is reduced to `now + defaultTtl days`
- If `expiresAt` is set and is within the ceiling → input is returned unchanged

#### Scenario: No defaultTtl configured — input unchanged

- **WHEN** `applyDefaultTtl` is called with a policy where `defaultTtl` is `undefined`
- **THEN** the input is returned unchanged

#### Scenario: No expiry set — defaultTtl applied

- **WHEN** `applyDefaultTtl` is called with `defaultTtl: 7` and no `expiresAt` in input
- **THEN** `expiresAt` is set to `now + 7 days` in the returned input

#### Scenario: Expiry exceeds ceiling — reduced to ceiling

- **WHEN** `applyDefaultTtl` is called with `defaultTtl: 7` and `expiresAt` of `now + 30 days`
- **THEN** `expiresAt` is reduced to `now + 7 days` in the returned input

#### Scenario: Expiry within ceiling — preserved

- **WHEN** `applyDefaultTtl` is called with `defaultTtl: 14` and `expiresAt` of `now + 3 days`
- **THEN** `expiresAt` remains `now + 3 days` in the returned input

### Requirement: Policy pipeline runner

The policy module SHALL provide `runValidation` and `runTransformation` runner functions that compose arrays of validators or transformers over a shared input.

- `runValidation(validators, policy, input)` — runs each validator in order; returns the first error encountered or `Result.ok(undefined)` if all pass
- `runTransformation(transformers, policy, input)` — runs each transformer in order, threading the output of one as the input of the next; returns the final transformed input

#### Scenario: Validation passes all validators

- **WHEN** `runValidation` is called with multiple validators that all pass
- **THEN** it returns `Result.ok(undefined)`

#### Scenario: Validation fails on first failing validator

- **WHEN** `runValidation` is called with validators where the second fails
- **THEN** it returns the error from the second validator
- **AND** subsequent validators are NOT run

#### Scenario: Transformation chains multiple transformers

- **WHEN** `runTransformation` is called with two transformers
- **THEN** the second transformer receives the output of the first
- **AND** the final result is the output of the last transformer
