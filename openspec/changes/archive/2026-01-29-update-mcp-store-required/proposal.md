# Change: Make Store Parameter Required and Rename Default Store

## Why

Agents currently get confused about store naming. They pass `'global'` as a literal store name instead of understanding it as a fallback. Making `store` a required parameter forces explicit store selection and eliminates ambiguity. Renaming the default store from `'global'` to `'default'` further clarifies that it's the fallback store, not a semantic concept.

## What Changes

- **BREAKING**: Make `store` parameter required on all MCP memory tools
- Rename default store from `'global'` to `'default'` in server configuration
- Update tool schemas and descriptions to reflect required store parameter

## Impact

- Affected specs: `mcp-memory-tools`, `mcp-server-core`
- Affected code:
    - `src/server/config.ts` - change `defaultStore` default from `'global'` to `'default'`
    - `src/server/memory/tools.ts` - make `store` required in all schemas
    - Agent configurations (external) - must update to always specify store
