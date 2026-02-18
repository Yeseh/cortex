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

The MCP server SHALL provide a `cortex://store/{name}` resource that returns store metadata including category mode and defined hierarchy.

#### Scenario: Accessing store details

- **WHEN** an agent requests `cortex://store/global`
- **THEN** the server returns metadata for the "global" store including `categoryMode` and root categories

#### Scenario: Non-existent store

- **WHEN** an agent requests a resource for a store that does not exist
- **THEN** the server returns an appropriate not-found error

#### Scenario: Store with category hierarchy

- **WHEN** a store has categories defined in config
- **THEN** the resource response includes the full category hierarchy with paths and descriptions

#### Scenario: Store without category config

- **WHEN** a store has no `categories` defined in config
- **THEN** the resource response includes an empty categories array

### Requirement: List stores includes hierarchy

The `cortex_list_stores` tool response SHALL include the config-defined category hierarchy, not disk state. Each store entry includes `categoryMode` and a recursive `categories` array.

#### Scenario: List stores response shape

- **WHEN** an agent calls `cortex_list_stores`
- **THEN** each store includes `name`, `path`, `description`, `categoryMode`, and `categories`

#### Scenario: Category hierarchy in response

- **WHEN** a store defines nested categories in config
- **THEN** the `categories` array contains recursive objects with `path`, `description`, and `subcategories`

#### Scenario: Store in free mode with no defined categories

- **WHEN** a store has `categoryMode: free` and no `categories` defined
- **THEN** the response shows `categoryMode: "free"` and `categories: []`

