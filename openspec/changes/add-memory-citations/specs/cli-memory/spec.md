## MODIFIED Requirements

### Requirement: Memory CRUD commands

The CLI SHALL provide add, show, update, remove, and move commands for memories. The `add` and `update` commands SHALL accept a repeatable `--citation` flag to attach source references.

#### Scenario: Creating a memory

- **WHEN** a user runs `cortex add category/memory --content "..."`
- **THEN** the memory is stored at the target path

#### Scenario: Creating a memory with citations

- **WHEN** a user runs `cortex add category/memory --content "..." --citation src/types.ts:17 --citation https://docs.example.com`
- **THEN** the memory is created with the specified citations in its metadata

#### Scenario: Updating a memory with citations

- **WHEN** a user runs `cortex update category/memory --citation src/new-path.ts:5`
- **THEN** the memory's citations are replaced with the provided values
