# mcp-store-tools Specification

## Purpose

MCP tools for store discovery and management, enabling AI agents to list available stores and create new stores.

## ADDED Requirements

### Requirement: List stores tool

The MCP server SHALL provide a `list_stores` tool that returns all stores in the configured data folder.

#### Scenario: Listing stores

- **WHEN** an agent calls the `list_stores` tool
- **THEN** the server returns a list of all store names in the data folder

#### Scenario: Empty data folder

- **WHEN** no stores exist in the data folder
- **THEN** the tool returns an empty list

### Requirement: Create store tool

The MCP server SHALL provide a `create_store` tool that explicitly creates a new store.

#### Scenario: Creating a new store

- **WHEN** an agent calls `create_store` with a valid name
- **THEN** a new store is created with the specified name

#### Scenario: Store already exists

- **WHEN** an agent calls `create_store` with an existing store name
- **THEN** the tool returns an error indicating the store already exists

#### Scenario: Invalid store name

- **WHEN** an agent calls `create_store` with an invalid name (e.g., contains special characters)
- **THEN** the tool returns a validation error
