## MODIFIED Requirements

### Requirement: Store registry format

The system SHALL store named store definitions in a YAML registry file that maps store names to path values and optional descriptions.

#### Scenario: Registry format with top-level mapping

- **WHEN** the registry file contains store names as top-level keys
- **THEN** each store name maps to its configured path value

#### Scenario: Registry format with stores section

- **WHEN** the registry file contains a top-level `stores` mapping
- **THEN** the system reads store names from the `stores` mapping

#### Scenario: Path value requirements

- **WHEN** a store entry is parsed
- **THEN** the store path MUST be a non-empty string value

#### Scenario: Missing path value

- **WHEN** a store entry omits its path value or provides a non-string value
- **THEN** the system returns a registry format error

#### Scenario: Duplicate store names

- **WHEN** a store name is defined more than once in the registry
- **THEN** the system returns a duplicate name error

#### Scenario: Inline comments

- **WHEN** the registry file includes YAML comments on the same line as a store entry
- **THEN** the system ignores the comments and reads the store name and path value

#### Scenario: Optional description field

- **WHEN** a store entry includes a `description` field
- **THEN** the system stores the description as metadata for the store

#### Scenario: Description field omitted

- **WHEN** a store entry omits the `description` field
- **THEN** the system treats the description as undefined (no error)

## ADDED Requirements

### Requirement: List stores MCP tool

The MCP server SHALL provide a `cortex_list_stores` tool that returns all registered stores with their metadata.

#### Scenario: Listing available stores

- **WHEN** an agent calls `cortex_list_stores`
- **THEN** the tool returns a list of stores with name, path, and description for each

#### Scenario: Store without description

- **WHEN** a store has no description configured
- **THEN** the store is included in the list with description omitted or null

#### Scenario: Empty registry

- **WHEN** no stores are registered
- **THEN** the tool returns an empty list
