# MCP Tool Reference

## Store Parameter

**IMPORTANT**: The `store` parameter is **required** on all memory and category operations. You must always explicitly specify which store to use:

- Use `"default"` for the global default store (personal memories, human preferences, project references)
- Use a project-specific store name (e.g., `"my-project"`) for project-isolated knowledge

This prevents ambiguity and ensures you always know which store your memories are being written to or read from.

## Memory Operations

### cortex_add_memory

Create a new memory with auto-creation of categories.

```
cortex_add_memory(
  store: "default",
  path: "projects/cortex/testing/policy",
  content: "Run tests before committing. Fix failures before moving on.",
  tags: ["testing", "workflow"]
)
```

**Parameters:**

- `store` (required) - Store name (e.g., `"default"` or project store name)
- `path` (required) - Memory path in `category/subcategory/.../slug` format
- `content` (required) - Memory content (markdown supported)
- `tags` (optional) - Array of tags for categorization
- `expires_at` (optional) - Expiration date (ISO 8601)

### cortex_get_memory

Retrieve memory content and metadata.

```
cortex_get_memory(store: "default", path: "human/profile/identity")
```

**Parameters:**

- `store` (required) - Store name
- `path` (required) - Memory path
- `include_expired` (optional, default: false) - Include expired memories

### cortex_update_memory

Update memory content or metadata.

```
cortex_update_memory(
  store: "default",
  path: "projects/cortex/testing/policy",
  content: "Updated policy content",
  tags: ["testing", "ci"]
)
```

**Parameters:**

- `store` (required) - Store name
- `path` (required) - Memory path
- `content` (optional) - New content
- `tags` (optional) - New tags (replaces existing)
- `expires_at` (optional) - New expiration date
- `clear_expiry` (optional) - Remove expiration date

### cortex_remove_memory

Delete a memory.

```
cortex_remove_memory(store: "default", path: "projects/old-project/deprecated")
```

**Parameters:**

- `store` (required) - Store name
- `path` (required) - Memory path

### cortex_move_memory

Move or rename a memory.

```
cortex_move_memory(
  store: "default",
  from_path: "human/old-preference",
  to_path: "human/preferences/coding"
)
```

**Parameters:**

- `store` (required) - Store name
- `from_path` (required) - Source memory path
- `to_path` (required) - Destination memory path

### cortex_list_memories

List memories and subcategories in a category.

```
cortex_list_memories(store: "default", category: "projects/cortex")
```

**Parameters:**

- `store` (required) - Store name
- `category` (optional) - Category path (lists root if omitted)
- `include_expired` (optional, default: false) - Include expired memories

**Response includes:**

- `memories[]` - Array with path, token_estimate, summary, is_expired
- `subcategories[]` - Array with path, memory_count, description
- `count` - Total memory count

### cortex_prune_memories

Delete all expired memories.

```
cortex_prune_memories(store: "default")
```

**Parameters:**

- `store` (required) - Store name

## Store Operations

### cortex_list_stores

List all available memory stores with their metadata.

```
cortex_list_stores()
```

**Response:**

```json
{
    "stores": [
        {
            "name": "default",
            "path": "/path/to/default",
            "description": "Default store for general memories"
        },
        {
            "name": "project",
            "path": "/path/to/project"
        }
    ]
}
```

**Response fields:**

- `stores[]` - Array of store objects sorted alphabetically by name
    - `name` - Store name (lowercase slug)
    - `path` - Path to store directory
    - `description` - Optional store description (only present if defined)

**Notes:**

- Returns empty list if no stores are registered
- Stores are read from the `stores.yaml` registry file
- Stores without descriptions will not have the `description` field

### cortex_create_store

Create a new store.

```
cortex_create_store(name: "my-project")
```

## Category Operations

### cortex_create_category

Create a category hierarchy.

```
cortex_create_category(store: "default", path: "projects/new-project/docs")
```

**Parameters:**

- `store` (required) - Store name
- `path` (required) - Category path to create

Creates all parent categories automatically.

### cortex_set_category_description

Set a description for a category (helps with discovery).

```
cortex_set_category_description(
  store: "default",
  path: "projects/cortex",
  description: "Cortex memory system - MCP server and CLI"
)
```

**Parameters:**

- `store` (required) - Store name
- `path` (required) - Category path
- `description` (required) - Description text (empty string to clear)

**Constraints:**

- Maximum 500 characters
- Root categories cannot have descriptions
- Empty string clears description

### cortex_delete_category

Delete a category and all its contents recursively.

```
cortex_delete_category(store: "default", path: "projects/old-project")
```

**Parameters:**

- `store` (required) - Store name
- `path` (required) - Category path to delete

**Warning:** This deletes all memories and subcategories within the path.

## Resources (Read-Only)

MCP resources provide read-only access to memory data:

| Resource URI             | Description                        |
| ------------------------ | ---------------------------------- |
| `cortex://store/`        | List all stores                    |
| `cortex://store/{name}`  | Store metadata and root categories |
| `cortex://memory/{path}` | Memory content                     |
