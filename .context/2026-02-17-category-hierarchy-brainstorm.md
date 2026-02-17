# Category Hierarchy Enforcement - Brainstorming Session

**Date:** 2026-02-17  
**Status:** Brainstorm Complete  
**Participants:** Jesse, Claude

## Feature Overview

Add the ability to define and enforce category hierarchies per store in `config.yaml`. A `categoryMode` setting controls how strictly the hierarchy is enforced, ranging from fully permissive (`free`) to completely locked (`strict`).

## Core Design Decisions

### 1. No Implicit Category Creation in `createMemory`

**Breaking Change**: `createMemory` will no longer auto-create categories. Categories must exist on disk before memories can be placed in them. This applies to ALL modes.

- Agent must call `create_category` first (in `free` or `subcategories` mode)
- Or categories must be bootstrapped via CLI `init`/`store init` templates

### 2. Category Mode Behaviors

| Mode            | Description                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `free`          | Agent can create/delete any categories. Most permissive. Default if not specified.                                                  |
| `subcategories` | Agent can only create/delete non-root categories. Root categories must be defined in config or already exist on disk.               |
| `strict`        | Agent cannot create or delete any categories. `create_category` and `delete_category` tools are not registered with the MCP server. |

### 3. Config-Defined Categories Are Protected

All categories defined in the config hierarchy (at any depth) are protected:

- Cannot be deleted via `delete_category`
- Cannot have descriptions modified via `set_category_description`
- Error message: `"Cannot delete category 'standards': category is defined in store configuration and is protected. Remove it from config.yaml to allow deletion."`

### 4. Legacy/Non-Config Categories Remain Operable

Categories that exist on disk but are not in config:

- Can have memories created in them
- Can be deleted (respecting mode rules for root vs non-root)
- Can have descriptions set
- Appear in `list_memories` responses (disk state)

## Config Schema

```yaml
settings:
    outputFormat: yaml

stores:
    cortex:
        path: /home/jesse/.cortex/memory
        description: Project memory store
        categoryMode: strict # free | subcategories | strict (default: free)
        categories:
            standards:
                description: 'Architecture decisions and coding standards'
                subcategories:
                    architecture:
                        description: 'System architecture patterns'
                    testing:
                        description: 'Testing conventions'
            todo:
                description: 'Outstanding work items'
            decisions:
                description: 'Development decisions with rationale'
                subcategories:
                    config: {} # No description - still protected
```

**Schema Notes:**

- `categoryMode` defaults to `free` if not specified
- `categoryMode: strict` with no `categories` key means no categories are allowed
- Arbitrary nesting depth supported
- Empty description (`{}` or `description: ""`) means no description, but category is still protected
- All ancestors of defined categories are implicitly protected

## Operation Behaviors by Mode

### `create_category`

| Scenario                                    | `free`        | `subcategories`        | `strict`               |
| ------------------------------------------- | ------------- | ---------------------- | ---------------------- |
| Create root category (in config)            | ✅ Idempotent | ✅ Idempotent          | 🚫 Tool not registered |
| Create root category (not in config)        | ✅            | ❌ Error with guidance | 🚫 Tool not registered |
| Create non-root category                    | ✅            | ✅                     | 🚫 Tool not registered |
| Create nested path (auto-creates ancestors) | ✅            | ✅ if no new roots     | 🚫 Tool not registered |

**`subcategories` mode error:**

```
"Cannot create root category 'new-root': store is in 'subcategories' mode.
Allowed root categories: standards, todo, decisions.
You may create subcategories under these."
```

### `delete_category`

| Scenario                        | `free`       | `subcategories` | `strict`               |
| ------------------------------- | ------------ | --------------- | ---------------------- |
| Delete config-defined category  | ❌ Protected | ❌ Protected    | 🚫 Tool not registered |
| Delete non-config root category | ✅           | ✅              | 🚫 Tool not registered |
| Delete non-config subcategory   | ✅           | ✅              | 🚫 Tool not registered |

### `set_category_description`

| Scenario                | `free`       | `subcategories` | `strict`     |
| ----------------------- | ------------ | --------------- | ------------ |
| Config-defined category | ❌ Protected | ❌ Protected    | ❌ Protected |
| Non-config category     | ✅           | ✅              | ✅           |

**Note:** `set_category_description` is always registered (all modes) but rejects config-defined categories.

### `createMemory`

| Scenario                | `free`   | `subcategories` | `strict` |
| ----------------------- | -------- | --------------- | -------- |
| Category exists on disk | ✅       | ✅              | ✅       |
| Category missing        | ❌ Error | ❌ Error        | ❌ Error |

**Error message:**

```
"Cannot create memory at 'nonexistent/path': category 'nonexistent' does not exist.
Create the category first using create_category."
```

## MCP Tool Registration

In `strict` mode, the MCP server **does not register** `cortex_create_category` and `cortex_delete_category` tools. This completely prevents agents from attempting these operations.

- Tool registration happens at MCP server startup
- Mode is read from `config.yaml` store definition
- Single-store MCP server (one store per server instance)

## `list_stores` Response Shape

Returns the **defined hierarchy from config**, not disk state:

```json
{
    "stores": [
        {
            "name": "cortex",
            "path": "/home/jesse/.cortex/memory",
            "description": "Project memory store",
            "categoryMode": "strict",
            "categories": [
                {
                    "path": "standards",
                    "description": "Architecture decisions and coding standards",
                    "subcategories": [
                        {
                            "path": "standards/architecture",
                            "description": "System architecture patterns",
                            "subcategories": []
                        },
                        {
                            "path": "standards/testing",
                            "description": "Testing conventions",
                            "subcategories": []
                        }
                    ]
                },
                {
                    "path": "todo",
                    "description": "Outstanding work items",
                    "subcategories": []
                }
            ]
        }
    ]
}
```

## `list_memories` Behavior

**Unchanged**: Returns actual disk state (discovered categories and memories), not config-defined hierarchy. This allows:

- Legacy categories to remain discoverable
- Agents to see real system state
- Users to identify categories that should be cleaned up

## Enforcement Locations

| Layer                  | Enforces Mode?                                  |
| ---------------------- | ----------------------------------------------- |
| Core domain operations | ✅ Yes                                          |
| MCP server             | ✅ Yes (tool registration + delegation to core) |
| CLI                    | ✅ Yes (delegation to core)                     |
| Storage adapters       | ❌ No (pure I/O, no policy)                     |

## CLI Bootstrapping

`cortex init` and `cortex store init` commands will:

1. Write hierarchy definition to `config.yaml`
2. Call domain operations (`createCategory`) to create directories on disk
3. Use predefined templates for common setups

## Validation Timing

- **At operation time**: Mode enforcement happens when operations are attempted
- **Design-time validation**: Deferred to future work (e.g., config validation warnings)

## Edge Cases

| Scenario                                                  | Behavior                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `categoryMode: strict` + no `categories` key              | No categories allowed; any `createMemory` to categorized path fails             |
| Config defines `a/b/c`, agent creates `a/b/c/d/e`         | Allowed in `free`/`subcategories` (non-root); must call `create_category` first |
| Agent creates `new-root/sub/deep` in `subcategories` mode | Error: would create new root `new-root`                                         |
| Delete ancestor of config-defined category                | Error: all ancestors are protected                                              |
| `set_category_description` on config-defined category     | Error: protected by config                                                      |
| Legacy category exists on disk, not in config             | Can create memories, can delete (if mode allows), can set description           |

## Breaking Changes Summary

1. **`createMemory` no longer auto-creates categories** - requires `create_category` first
2. **New config schema** - `categoryMode` and `categories` keys in store definition
3. **`list_stores` response shape changed** - includes hierarchy information

## Future Considerations (Deferred)

- Environment variable configuration for `categoryMode`
- Config-time validation/warnings for disk vs config mismatches
- CLI commands to manage config-defined categories
- Protected root categories (`human`, `persona`) - may be superseded by config protection

## Related Files

- `packages/core/src/config.ts` - Config parsing
- `packages/core/src/category/operations/create.ts` - Category creation
- `packages/core/src/memory/operations/create.ts` - Memory creation (needs modification)
- `packages/server/src/category/tools.ts` - MCP category tools
- `packages/server/src/store/tools.ts` - list_stores implementation
