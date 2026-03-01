## ADDED Requirements

### Requirement: Create memory policy enforcement

The `createMemory` operation SHALL resolve the effective policy for the target category and enforce it before persisting the memory. The enforcement order is: validate permissions and constraints first, then apply transformations to the input.

- `permissions.create: false` → return error `OPERATION_NOT_PERMITTED`
- `maxContentLength` exceeded → return error `CONTENT_TOO_LONG`
- `defaultTtl` present → silently apply as expiry ceiling using `min(explicit, defaultTtl)` semantics (transformation, not error)

#### Scenario: Create blocked by permission policy

- **WHEN** the target category has `permissions.create: false` in its effective policy
- **AND** `createMemory` is called targeting that category
- **THEN** the operation returns an error with code `OPERATION_NOT_PERMITTED`
- **AND** the error message identifies the category and instructs the agent to update config to change the policy

#### Scenario: Create blocked by content length policy

- **WHEN** the target category has `maxContentLength: 5000` in its effective policy
- **AND** `createMemory` is called with content exceeding 5000 characters
- **THEN** the operation returns an error with code `CONTENT_TOO_LONG`
- **AND** the error message states the limit, the actual length, and suggests reducing content or splitting into multiple memories

#### Scenario: Default TTL applied when no expiry set

- **WHEN** the target category has `defaultTtl: 7` in its effective policy
- **AND** `createMemory` is called without an explicit expiry
- **THEN** the memory is created with expiry set to `now + 7 days`

#### Scenario: Default TTL used as ceiling when explicit expiry exceeds it

- **WHEN** the target category has `defaultTtl: 7` in its effective policy
- **AND** `createMemory` is called with `expiresAt` set to `now + 30 days`
- **THEN** the memory is created with expiry reduced to `now + 7 days`

#### Scenario: Explicit expiry under defaultTtl is preserved

- **WHEN** the target category has `defaultTtl: 14` in its effective policy
- **AND** `createMemory` is called with `expiresAt` set to `now + 3 days`
- **THEN** the memory is created with expiry of `now + 3 days` (agent's value preserved)

#### Scenario: No policy configured — memory created normally

- **WHEN** the target category has no policies configured (system defaults apply)
- **AND** `createMemory` is called with valid input
- **THEN** the memory is created without policy errors

### Requirement: Update memory policy enforcement

The `updateMemory` operation SHALL resolve the effective policy for the target category and enforce it before persisting changes.

- `permissions.update: false` → return error `OPERATION_NOT_PERMITTED`
- `maxContentLength` exceeded → return error `CONTENT_TOO_LONG`

#### Scenario: Update blocked by permission policy

- **WHEN** the target category has `permissions.update: false` in its effective policy
- **AND** `updateMemory` is called targeting that category
- **THEN** the operation returns an error with code `OPERATION_NOT_PERMITTED`
- **AND** the error message identifies the category and the blocked operation

#### Scenario: Update blocked by content length policy

- **WHEN** the target category has `maxContentLength: 5000` in its effective policy
- **AND** `updateMemory` is called with updated content exceeding 5000 characters
- **THEN** the operation returns an error with code `CONTENT_TOO_LONG`

#### Scenario: Update allowed when policy permits

- **WHEN** the target category has no update restriction in its effective policy
- **AND** `updateMemory` is called with valid input
- **THEN** the memory is updated normally

### Requirement: Delete memory policy enforcement

The `deleteMemory` operation SHALL resolve the effective policy for the target category and enforce it before removing the memory.

- `permissions.delete: false` → return error `OPERATION_NOT_PERMITTED`

#### Scenario: Delete blocked by permission policy

- **WHEN** the target category has `permissions.delete: false` in its effective policy
- **AND** `deleteMemory` is called targeting that category
- **THEN** the operation returns an error with code `OPERATION_NOT_PERMITTED`
- **AND** the error message identifies the category and instructs the agent to update config to change the policy

#### Scenario: Delete allowed when policy permits

- **WHEN** the target category has no delete restriction in its effective policy
- **AND** `deleteMemory` is called for an existing memory
- **THEN** the memory is deleted normally
