## MODIFIED Requirements

### Requirement: Memory listing

The CLI SHALL list memories via `cortex memory list` and hide expired entries by default.

#### Scenario: Listing active memories

- **WHEN** a user runs `cortex memory list`
- **THEN** the CLI excludes expired memories unless `-x/--include-expired` is set

#### Scenario: Listing with category filter

- **WHEN** a user runs `cortex memory list project`
- **THEN** only memories in the `project` category are listed

## REMOVED Requirements

### Requirement: Pruning expired memories

**Reason**: Moved to `cli-store` spec as `store prune` command.

**Migration**: Use `cortex store prune` instead of `cortex prune`.
