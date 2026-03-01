## MODIFIED Requirements

### Requirement: Create category operation

The system SHALL provide a `createCategory` operation that creates a category and its parent hierarchy. Before creating a category, the operation SHALL resolve the effective policy for the parent category and enforce the `subcategoryCreation` policy.

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

#### Scenario: Subcategory creation denied by policy

- **WHEN** the parent category has `subcategoryCreation: false` in its effective policy
- **AND** `createCategory` is called for a new child under that parent
- **THEN** the operation returns an error with code `SUBCATEGORY_CREATION_NOT_ALLOWED`
- **AND** the error message tells the agent which category blocked creation and how to update config to change the policy

#### Scenario: Policy check skipped for already-existing category

- **WHEN** `createCategory` is called on a path that already exists
- **THEN** no policy check is performed
- **AND** the operation returns `{ path, created: false }` without error

### Requirement: Set description operation

The system SHALL provide a `setDescription` operation that sets or clears a category's description. Before updating, the operation SHALL resolve the effective policy for the category and enforce the `permissions.update` policy.

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

#### Scenario: Update denied by policy

- **WHEN** the category has `permissions.update: false` in its effective policy
- **AND** `setDescription` is called on that category
- **THEN** the operation returns an error with code `OPERATION_NOT_PERMITTED`
- **AND** the error message identifies the category and policy that blocked the operation

### Requirement: Delete category operation

The system SHALL provide a `deleteCategory` operation that removes a category and all its contents. Before deleting, the operation SHALL resolve the effective policy for the category and enforce the `permissions.delete` policy.

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

#### Scenario: Delete denied by policy

- **WHEN** the category has `permissions.delete: false` in its effective policy
- **AND** `deleteCategory` is called on that category
- **THEN** the operation returns an error with code `OPERATION_NOT_PERMITTED`
- **AND** the error message identifies the category and policy that blocked the deletion
