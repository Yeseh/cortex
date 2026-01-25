# mcp-memory-resources Specification

## Purpose

MCP resources for read-only access to memory content and category listings via URI-based addressing.

## ADDED Requirements

### Requirement: Memory content resource

The MCP server SHALL provide a `cortex://memory/{store}/{path}` resource that returns memory content for leaf paths.

#### Scenario: Accessing a memory

- **WHEN** an agent requests `cortex://memory/global/standards/typescript/eslint-config`
- **THEN** the server returns the memory content and metadata

#### Scenario: Non-existent memory

- **WHEN** an agent requests a resource for a memory that does not exist
- **THEN** the server returns an appropriate not-found error

#### Scenario: Expired memory

- **WHEN** an agent requests an expired memory via resource
- **THEN** the server returns a not-found error (expired memories not accessible via resources)

### Requirement: Category listing resource

The MCP server SHALL provide a `cortex://memory/{store}/{path}/` resource that returns category contents for directory paths.

#### Scenario: Listing category contents

- **WHEN** an agent requests `cortex://memory/project-x/decisions/`
- **THEN** the server returns a list of memories and subcategories in that category

#### Scenario: Empty category

- **WHEN** an agent requests a category that exists but is empty
- **THEN** the server returns an empty listing

#### Scenario: Non-existent category

- **WHEN** an agent requests a category that does not exist
- **THEN** the server returns an appropriate not-found error

### Requirement: Path disambiguation

The MCP server SHALL use trailing slashes to distinguish between memory content and category listings.

#### Scenario: Path without trailing slash

- **WHEN** a path does not end with `/`
- **THEN** the server treats it as a memory content request

#### Scenario: Path with trailing slash

- **WHEN** a path ends with `/`
- **THEN** the server treats it as a category listing request
