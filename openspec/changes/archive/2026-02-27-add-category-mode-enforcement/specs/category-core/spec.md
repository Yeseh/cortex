## MODIFIED Requirements

### Requirement: Create category operation

The system SHALL provide a `createCategory` operation that creates a category and its parent hierarchy, subject to mode enforcement.

#### Scenario: Creating a new category in free mode

- **WHEN** `createCategory("projects/cortex/arch")` is called in `free` mode
- **THEN** the category `projects/cortex/arch` is created with an empty `index.yaml`
- **AND** parent category `projects/cortex` is created with an empty `index.yaml` if it doesn't exist

#### Scenario: Idempotent creation

- **WHEN** `createCategory` is called on an existing category
- **THEN** the operation returns `{ path, created: false }` without error

#### Scenario: Creating root category in subcategories mode

- **WHEN** `createCategory("new-root")` is called in `subcategories` mode
- **AND** `new-root` is not defined in config
- **THEN** the operation returns an error with code `ROOT_CATEGORY_NOT_ALLOWED`
- **AND** the error message lists allowed root categories

#### Scenario: Creating subcategory in subcategories mode

- **WHEN** `createCategory("standards/new-sub")` is called in `subcategories` mode
- **AND** `standards` is a config-defined root category
- **THEN** the category is created successfully

#### Scenario: Creating config-defined category is idempotent

- **WHEN** `createCategory("standards")` is called on a config-defined category
- **THEN** the operation returns `{ path, created: false }` without error

### Requirement: Delete category operation

The system SHALL provide a `deleteCategory` operation that removes a category and all its contents, rejecting config-defined categories.

#### Scenario: Deleting a non-config category

- **WHEN** `deleteCategory("legacy/old")` is called
- **AND** `legacy/old` is not config-defined
- **THEN** the category directory is removed recursively
- **AND** the subcategory entry is removed from the parent's `index.yaml`

#### Scenario: Deleting a config-defined category

- **WHEN** `deleteCategory("standards")` is called
- **AND** `standards` is config-defined
- **THEN** the operation returns an error with code `CATEGORY_PROTECTED`
- **AND** the error message instructs to remove from config.yaml

#### Scenario: Deleting ancestor of config-defined category

- **WHEN** `deleteCategory("standards")` is called
- **AND** `standards/architecture` is config-defined (making `standards` implicitly protected)
- **THEN** the operation returns an error with code `CATEGORY_PROTECTED`

#### Scenario: Root category rejection

- **WHEN** `deleteCategory("projects")` is called on a root category
- **THEN** the operation returns an explicit error

### Requirement: Set description operation

The system SHALL provide a `setDescription` operation that sets or clears a category's description, rejecting config-defined categories.

#### Scenario: Setting description on non-config category

- **WHEN** `setDescription("legacy/notes", "Old notes")` is called
- **AND** `legacy/notes` is not config-defined
- **THEN** the description is stored in the parent category's `index.yaml`

#### Scenario: Setting description on config-defined category

- **WHEN** `setDescription("standards", "New description")` is called
- **AND** `standards` is config-defined
- **THEN** the operation returns an error with code `CATEGORY_PROTECTED`
- **AND** the error message instructs to update config.yaml

#### Scenario: Description validation

- **WHEN** a description exceeds 500 characters
- **THEN** the operation returns an error

#### Scenario: Root category rejection

- **WHEN** `setDescription("projects", "description")` is called on a root category
- **THEN** the operation returns an explicit error
