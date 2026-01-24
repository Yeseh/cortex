## MODIFIED Requirements
### Requirement: Store registry format
The system SHALL store named store definitions in a YAML registry file that maps store names to path values.

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

### Requirement: Store resolution behavior
The system SHALL resolve stores by checking a local .cortex directory first and falling back to the global registry only when strict_local is false.

#### Scenario: Local store precedence
- **WHEN** a local registry defines the requested store name
- **THEN** the system resolves the store using the local registry entry

#### Scenario: Strict local resolution
- **WHEN** strict_local is true and no local store exists
- **THEN** the system returns a resolution error

#### Scenario: Global fallback when strict_local is false
- **WHEN** strict_local is false and the local registry does not define the store
- **THEN** the system attempts to resolve the store from the global registry

#### Scenario: Global registry missing
- **WHEN** strict_local is false, the local registry does not define the store, and the global registry is missing
- **THEN** the system returns a global registry missing error

#### Scenario: Global store missing
- **WHEN** strict_local is false, the local registry does not define the store, and the global registry lacks the store name
- **THEN** the system returns a resolution error
