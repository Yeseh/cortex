## ADDED Requirements

### Requirement: Clear expiration via negation flag

The `memory update` command SHALL accept `--no-expires-at` to remove an expiration date from a memory. This replaces the former `--clear-expiry` / `-E` flag.

#### Scenario: Clearing expiration with negation flag

- **WHEN** a user runs `cortex memory update category/slug --no-expires-at`
- **THEN** the expiration date is removed from the memory
