---
created_at: 2026-01-26T21:26:25.445Z
updated_at: 2026-01-26T21:26:25.445Z
tags: [architecture, patterns, preferences]
source: mcp
---
## Architecture Preferences

- **Thin entrypoints**: Server (MCP) and CLI should remain thin wrappers; business logic belongs in core modules
- **Abstract interfaces**: Core modules should not depend on concrete implementations (e.g., filesystem). Use port/adapter pattern with abstract interfaces that only reference other core module types
- **Explicit methods over overloading**: Prefer dedicated methods for specific operations rather than overloading generic methods (e.g., `updateSubcategoryDescription` instead of extending `writeIndex`)
- **Separation of concerns**: Keep operations separated at core level (e.g., `create` and `setDescription` as distinct functions), combine for UX convenience at entrypoint level (MCP/CLI)