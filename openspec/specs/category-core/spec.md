# category-core Specification

## Purpose
TBD - created by archiving change add-category-descriptions. Update Purpose after archive.
## Requirements
### Requirement: Category storage port interface

The category module SHALL define a `CategoryStoragePort` interface for abstract storage access.

#### Scenario: Port interface definition

- **WHEN** the category module is initialized
- **THEN** it requires a `CategoryStoragePort` implementation with methods for reading/writing indexes, updating descriptions, and managing directories

### Requirement: Create category operation

The system SHALL provide a `createCategory` operation that creates a category and its parent hierarchy.

#### Scenario: Creating a new category

- **WHEN** `createCategory("projects/cortex/arch")` is called
- **THEN** the category `projects/cortex/arch` is created with an empty `index.yaml`
- **AND** parent category `projects/cortex` is created with an empty `index.yaml` if it doesn't exist

#### Scenario: Idempotent creation

- **WHEN** `createCategory` is called on an existing category
- **THEN** the operation returns `{ path, created: false }` without error

#### Scenario: Root category exclusion

- **WHEN** `createCategory("projects/cortex")` is called
- **THEN** the root category `projects` is NOT created (only non-root parents)

### Requirement: Set description operation

The system SHALL provide a `setDescription` operation that sets or clears a category's description.

#### Scenario: Setting a description

- **WHEN** `setDescription("projects/cortex", "Cortex project knowledge")` is called
- **THEN** the description is stored in the parent category's `index.yaml` under the subcategories entry

#### Scenario: Clearing a description

- **WHEN** `setDescription("projects/cortex", "")` is called with an empty string
- **THEN** the description is removed from the subcategory entry

#### Scenario: Description validation

- **WHEN** a description exceeds 500 characters
- **THEN** the operation returns an error

#### Scenario: Whitespace trimming

- **WHEN** a description has leading/trailing whitespace
- **THEN** the whitespace is trimmed before storage

#### Scenario: Root category rejection

- **WHEN** `setDescription("projects", "description")` is called on a root category
- **THEN** the operation returns an explicit error for agent feedback

#### Scenario: Non-existent category rejection

- **WHEN** `setDescription` is called on a category that doesn't exist
- **THEN** the operation returns an error (MCP layer handles auto-creation)

### Requirement: Delete category operation

The system SHALL provide a `deleteCategory` operation that removes a category and all its contents.

#### Scenario: Deleting a category

- **WHEN** `deleteCategory("projects/cortex")` is called
- **THEN** the category directory is removed recursively
- **AND** the subcategory entry is removed from the parent's `index.yaml`

#### Scenario: Deleting category with subcategories

- **WHEN** `deleteCategory` is called on a category with nested subcategories
- **THEN** all subcategories and their contents are deleted recursively

#### Scenario: Root category rejection

- **WHEN** `deleteCategory("projects")` is called on a root category
- **THEN** the operation returns an explicit error

### Requirement: Description persistence

Category descriptions SHALL persist independently of memory contents.

#### Scenario: Description persists after memory deletion

- **WHEN** all memories in a category are deleted
- **THEN** the category entry and its description remain in the parent's `index.yaml`

### Requirement: Description storage location

Category descriptions SHALL be stored in the parent category's `index.yaml` under the subcategories entry.

#### Scenario: Description in parent index

- **WHEN** a category `projects/cortex` has a description
- **THEN** the description is stored in `projects/index.yaml` under the `cortex` subcategory entry

