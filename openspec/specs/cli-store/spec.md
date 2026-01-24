# cli-store Specification

## Purpose
TBD - created by archiving change add-cli-store-management. Update Purpose after archive.
## Requirements
### Requirement: Store management commands
The CLI SHALL provide commands to list, add, remove, and initialize stores.

#### Scenario: Listing stores
- **WHEN** a user runs `cortex store list`
- **THEN** the CLI returns all registered stores

### Requirement: Store initialization
The CLI SHALL create a .cortex directory with a config and root index when initializing a store.

#### Scenario: Initializing a store
- **WHEN** a user runs `cortex store init`
- **THEN** a .cortex directory is created with required files

