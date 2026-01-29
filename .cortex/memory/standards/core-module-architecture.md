---
created_at: 2026-01-27T20:20:32.706Z
updated_at: 2026-01-27T21:15:29.805Z
tags: [architecture, patterns, ports-and-adapters, hexagonal, file-organization]
source: mcp
---
Business logic modules in Cortex follow the ports and adapters (hexagonal) architecture pattern.

**Core Principles:**
- **Thin entrypoints**: Server (MCP) and CLI should remain thin wrappers; business logic belongs in core modules
- **Abstract interfaces**: Core modules should not depend on concrete implementations (e.g., filesystem). Use abstract interfaces that only reference other core module types
- **Explicit methods over overloading**: Prefer dedicated methods for specific operations rather than overloading generic methods (e.g., `updateSubcategoryDescription` instead of extending `writeIndex`)
- **Separation of concerns**: Keep operations separated at core level (e.g., `create` and `setDescription` as distinct functions), combine for UX convenience at entrypoint level (MCP/CLI)

**File Structure:**
- `operations.ts` - Pure business logic functions (or split into named files if large)
- `types.ts` - Defines the port interface (contract), error types with discriminated unions, and result types
- `index.ts` - Barrel file that exports the public API; re-exports are explicit and selective

**Scaling Operations:**
When `operations.ts` grows beyond ~500 lines, split individual operations into separate files named after the operation:
```
src/core/{module}/
├── index.ts
├── types.ts
├── create.ts          # createCategory operation
├── create.spec.ts
├── delete.ts          # deleteCategory operation
├── delete.spec.ts
├── set-description.ts # setDescription operation
└── set-description.spec.ts
```

The barrel `index.ts` re-exports from all operation files, maintaining a unified public API.

**Benefits:**
- Testing business logic with mock storage implementations
- Swapping storage backends without changing business logic
- Clear separation between "what" (business rules) and "how" (storage)

**Example structure (small module):**
```
src/core/{module}/
├── index.ts           # Public API barrel exports
├── types.ts           # Port interface, error codes, result types
├── operations.ts      # Pure business logic functions
└── operations.spec.ts # Unit tests with mock storage
```