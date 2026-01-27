---
created_at: 2026-01-26T21:26:28.930Z
updated_at: 2026-01-27T20:25:48.832Z
tags: [conventions, naming, patterns, idempotent]
source: mcp
---
## Project Conventions

- **MCP tool naming**: Use `cortex_` prefix for all MCP tools (e.g., `cortex_create_category`, `cortex_add_memory`)
- **Core module location**: Business logic modules go in `src/core/<domain>/` (e.g., `src/core/category/`, `src/core/index/`)
- **Root categories are special**: Root-level categories (human, persona, project, domain) are set by convention and have special treatment (no descriptions, cannot be deleted)

**Idempotency Patterns:**
- **Create operations:** Idempotent - return success with `created: false` if already exists
- **Delete operations:** NOT idempotent - return error if resource doesn't exist
- **Update operations:** Idempotent - same input produces same output