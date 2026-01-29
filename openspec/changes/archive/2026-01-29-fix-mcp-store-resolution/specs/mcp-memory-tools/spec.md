## MODIFIED Requirements

### Requirement: Required store parameter

All memory tools SHALL require an explicit `store` parameter. The tools SHALL NOT fall back to a default store when the parameter is omitted. Tools SHALL resolve the store name to a filesystem path using the store registry.

#### Scenario: Store parameter required

- **WHEN** an agent calls any memory tool without the `store` parameter
- **THEN** the tool returns a validation error indicating store is required

#### Scenario: Explicit store accepted

- **WHEN** an agent calls a memory tool with an explicit `store` parameter
- **THEN** the tool looks up the store path in the registry and uses that path for the operation

#### Scenario: Store not in registry

- **WHEN** an agent calls a memory tool with a store name not found in the registry
- **THEN** the tool returns an error indicating the store is not registered
