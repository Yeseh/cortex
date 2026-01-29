## REMOVED Requirements

### Requirement: Default store parameter

**Reason**: Agents must now always specify the store explicitly. The implicit fallback to `CORTEX_DEFAULT_STORE` when `store` is omitted led to agent confusion about store semantics.

**Migration**: All MCP tool calls must include an explicit `store` parameter. Agents should use `cortex_list_stores` to discover available stores and select the appropriate one.

## ADDED Requirements

### Requirement: Required store parameter

All memory tools SHALL require an explicit `store` parameter. The tools SHALL NOT fall back to a default store when the parameter is omitted.

#### Scenario: Store parameter required

- **WHEN** an agent calls any memory tool without the `store` parameter
- **THEN** the tool returns a validation error indicating store is required

#### Scenario: Explicit store accepted

- **WHEN** an agent calls a memory tool with an explicit `store` parameter
- **THEN** the tool uses the specified store for the operation
