## MODIFIED Requirements

### Requirement: Memory CRUD commands

The CLI SHALL provide add, show, update, remove, and move commands for memories under the `memory` command group.

#### Scenario: Creating a memory

- **WHEN** a user runs `cortex memory add category/slug -c "..."`
- **THEN** the memory is stored at the target path

#### Scenario: Showing a memory

- **WHEN** a user runs `cortex memory show category/slug`
- **THEN** the memory content and metadata are displayed

#### Scenario: Updating a memory

- **WHEN** a user runs `cortex memory update category/slug -c "new content"`
- **THEN** the memory content is replaced

#### Scenario: Removing a memory

- **WHEN** a user runs `cortex memory remove category/slug`
- **THEN** the memory is deleted from the store

#### Scenario: Moving a memory

- **WHEN** a user runs `cortex memory move old/path new/path`
- **THEN** the memory is relocated to the new path

### Requirement: Content input methods

The CLI SHALL accept memory content via `-c/--content` flag, `-f/--file` flag, or stdin.

#### Scenario: Inline content

- **WHEN** a user runs `cortex memory add path -c "content"`
- **THEN** the CLI uses the flag value as memory content

#### Scenario: File content

- **WHEN** a user runs `cortex memory add path -f ./notes.md`
- **THEN** the CLI reads content from the specified file

#### Scenario: Piping content

- **WHEN** content is piped to `cortex memory add path`
- **THEN** the CLI uses stdin as the memory content

### Requirement: Category auto-creation on add

The CLI SHALL create missing categories only during add operations.

#### Scenario: Adding to a new category

- **WHEN** a user adds a memory to a non-existent category
- **THEN** the CLI creates the category structure

## ADDED Requirements

### Requirement: Memory command group

The CLI SHALL provide a `memory` command group that organizes all memory operations.

#### Scenario: Memory group help

- **WHEN** a user runs `cortex memory --help`
- **THEN** the CLI displays available memory subcommands

### Requirement: Store selection for memory commands

The `memory` command group SHALL accept a `-s/--store` option to select a named store, inherited by all subcommands.

#### Scenario: Using a named store

- **WHEN** a user runs `cortex memory -s work add project/notes -c "..."`
- **THEN** the memory is added to the `work` store

#### Scenario: Default store

- **WHEN** a user runs `cortex memory add project/notes -c "..."` without `-s`
- **THEN** the memory is added to the default resolved store

### Requirement: Memory metadata options

The `memory add` and `memory update` commands SHALL accept `-t/--tags` for comma-separated tags and `-e/--expires-at` for expiration date.

#### Scenario: Adding with tags

- **WHEN** a user runs `cortex memory add path -c "..." -t "tag1,tag2"`
- **THEN** the memory is created with the specified tags

#### Scenario: Setting expiration

- **WHEN** a user runs `cortex memory add path -c "..." -e "2026-12-31"`
- **THEN** the memory is created with the specified expiration date

### Requirement: Clear expiry option

The `memory update` command SHALL accept `-E/--clear-expiry` to remove an expiration date.

#### Scenario: Clearing expiration

- **WHEN** a user runs `cortex memory update path -E`
- **THEN** the memory's expiration date is removed

### Requirement: Include expired option

The `memory show` and `memory list` commands SHALL accept `-x/--include-expired` to include expired memories.

#### Scenario: Showing expired memory

- **WHEN** a user runs `cortex memory show path -x`
- **THEN** the memory is displayed even if expired

#### Scenario: Listing with expired

- **WHEN** a user runs `cortex memory list -x`
- **THEN** expired memories are included in the output

### Requirement: Output format option

The `memory show` and `memory list` commands SHALL accept `-o/--format` to specify output format (yaml, json, toon).

#### Scenario: JSON output

- **WHEN** a user runs `cortex memory list -o json`
- **THEN** the output is formatted as JSON
