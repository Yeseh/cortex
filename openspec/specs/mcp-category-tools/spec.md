# mcp-category-tools Specification

## Purpose
TBD - created by archiving change add-category-descriptions. Update Purpose after archive.
## Requirements
### Requirement: Create category tool

The MCP server SHALL provide a `cortex_create_category` tool that creates a category and its parent hierarchy.

#### Scenario: Creating a category

- **WHEN** an agent calls `cortex_create_category` with a path
- **THEN** the category is created along with any missing parent categories (excluding roots)

#### Scenario: Idempotent creation

- **WHEN** an agent calls `cortex_create_category` on an existing category
- **THEN** the operation succeeds with `{ path, created: false }`

#### Scenario: Using default store

- **WHEN** an agent calls `cortex_create_category` without specifying `store`
- **THEN** the operation uses the configured default store

### Requirement: Set category description tool

The MCP server SHALL provide a `cortex_set_category_description` tool that sets or clears a category's description.

#### Scenario: Setting a description

- **WHEN** an agent calls `cortex_set_category_description` with path and description
- **THEN** the description is stored for the category

#### Scenario: Auto-create category

- **WHEN** an agent calls `cortex_set_category_description` on a non-existent category
- **THEN** the category is automatically created before setting the description

#### Scenario: Clearing a description

- **WHEN** an agent calls `cortex_set_category_description` with an empty description
- **THEN** the description is removed from the category

#### Scenario: Root category rejection

- **WHEN** an agent calls `cortex_set_category_description` on a root category
- **THEN** an appropriate error is returned for agent feedback

#### Scenario: Description too long

- **WHEN** an agent provides a description exceeding 500 characters
- **THEN** an appropriate error is returned

### Requirement: Delete category tool

The MCP server SHALL provide a `cortex_delete_category` tool that removes a category and all its contents.

#### Scenario: Deleting a category

- **WHEN** an agent calls `cortex_delete_category` with a valid path
- **THEN** the category and all its contents are deleted recursively

#### Scenario: Root category rejection

- **WHEN** an agent calls `cortex_delete_category` on a root category
- **THEN** an appropriate error is returned

#### Scenario: Non-existent category

- **WHEN** an agent calls `cortex_delete_category` on a category that doesn't exist
- **THEN** an appropriate error is returned

### Requirement: Default store parameter

All category tools SHALL use `CORTEX_DEFAULT_STORE` when the `store` parameter is omitted.

#### Scenario: Using default store

- **WHEN** an agent calls any category tool without specifying `store`
- **THEN** the operation uses the configured default store

### Requirement: List memories includes description

The `cortex_list_memories` tool SHALL include category descriptions in the subcategories response.

#### Scenario: Listing categories with descriptions

- **WHEN** an agent calls `cortex_list_memories` and subcategories have descriptions
- **THEN** the response includes the description field for each subcategory that has one

