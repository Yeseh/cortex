## ADDED Requirements
### Requirement: Memory listing
The CLI SHALL list memories by category and hide expired entries by default.

#### Scenario: Listing active memories
- **WHEN** a user runs `cortex list`
- **THEN** the CLI excludes expired memories unless include-expired is set

### Requirement: Pruning expired memories
The CLI SHALL remove expired memories when the prune command is invoked.

#### Scenario: Pruning a store
- **WHEN** a user runs `cortex prune`
- **THEN** expired memories are deleted from the store
