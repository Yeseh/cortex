# cli-memory Specification

## Purpose
TBD - created by archiving change add-cli-memory-operations. Update Purpose after archive.
## Requirements
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

### Requirement: Content input methods
The CLI SHALL accept memory content via a flag, a file, or stdin.

#### Scenario: Piping content
- **WHEN** content is piped to `cortex add`
- **THEN** the CLI uses stdin as the memory content

### Requirement: Category auto-creation on add
The CLI SHALL create missing categories only during add operations.

#### Scenario: Adding to a new category
- **WHEN** a user adds a memory to a non-existent category
- **THEN** the CLI creates the category structure

### Requirement: Clear expiration via negation flag

The `memory update` command SHALL accept `--no-expires-at` to remove an expiration date from a memory. This replaces the former `--clear-expiry` / `-E` flag.

#### Scenario: Clearing expiration with negation flag

- **WHEN** a user runs `cortex memory update category/slug --no-expires-at`
- **THEN** the expiration date is removed from the memory

