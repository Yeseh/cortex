# cli-memory Specification

## Purpose
TBD - created by archiving change add-cli-memory-operations. Update Purpose after archive.
## Requirements
### Requirement: Memory CRUD commands
The CLI SHALL provide add, show, update, remove, and move commands for memories.

#### Scenario: Creating a memory
- **WHEN** a user runs `cortex add category/memory --content "..."`
- **THEN** the memory is stored at the target path

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

