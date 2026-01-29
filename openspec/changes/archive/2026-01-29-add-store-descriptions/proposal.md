# Change: Add Store Descriptions and List Stores Tool

## Why

Agents need a way to discover available stores and understand their purpose. Currently, the store registry only maps names to paths, providing no semantic information about what each store is for. This makes it difficult for agents to choose the appropriate store for different types of memories.

## What Changes

- Add optional `description` field to store registry format in `stores.yaml`
- Add new `cortex_list_stores` MCP tool that returns stores with their descriptions
- Enable agents to make informed decisions about where to store memories

## Impact

- Affected specs: `add-store-registry-and-resolution`
- Affected code:
    - `src/core/store/registry.ts` - parse/serialize description field
    - `src/server/store/tools.ts` - new `cortex_list_stores` tool
    - `src/server/store/index.ts` - register new tool
