# mcp-store-resources Specification

## Purpose
TBD - created by archiving change add-mcp-store-resources. Update Purpose after archive.
## Requirements
### Requirement: Store list resource

The MCP server SHALL provide a `cortex://store/` resource that lists all available stores.

#### Scenario: Accessing store list

- **WHEN** an agent requests the `cortex://store/` resource
- **THEN** the server returns a list of all store names

#### Scenario: No stores available

- **WHEN** no stores exist and the store list is requested
- **THEN** the server returns an empty list

### Requirement: Store detail resource

The MCP server SHALL provide a `cortex://store/{name}` resource that returns store metadata and root category listing.

#### Scenario: Accessing store details

- **WHEN** an agent requests `cortex://store/global`
- **THEN** the server returns metadata for the "global" store and its root categories

#### Scenario: Non-existent store

- **WHEN** an agent requests a resource for a store that does not exist
- **THEN** the server returns an appropriate not-found error

#### Scenario: Store with categories

- **WHEN** a store contains categories at the root level
- **THEN** the resource response includes the category listing

