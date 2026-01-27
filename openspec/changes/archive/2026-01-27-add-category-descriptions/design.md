## Context

The current codebase has category-related logic scattered across the MCP server and CLI layers. This change introduces a dedicated `src/core/category` module to centralize category business logic, using an abstract storage port to decouple from the filesystem implementation.

This establishes a pattern for future refactoring where server/CLI code becomes thin wrappers around pure core logic.

## Goals / Non-Goals

**Goals:**

- Centralize category business logic in a testable core module
- Enable unit testing without filesystem dependencies
- Provide clear separation between business rules and storage implementation
- Support future storage backends without changing core logic

**Non-Goals:**

- Refactoring all existing server/CLI code (this is a first step)
- Adding new storage backends (just the abstraction layer)
- Changing the fundamental storage format

## Decisions

### Decision: Abstract storage port interface

The category module uses a `CategoryStoragePort` interface rather than direct filesystem access.

**Rationale:** This enables pure unit testing of business logic and allows future storage backends without changing the core module.

**Alternatives considered:**

- Direct filesystem calls: Simpler but harder to test and inflexible
- Full repository pattern: More complex than needed for current scope

### Decision: Separate core operations from MCP convenience

Core provides `createCategory` and `setDescription` as separate operations. MCP layer combines them (auto-creates on `setDescription`).

**Rationale:**

- Core stays pure and predictable
- MCP layer provides agent-friendly UX
- Easier to test each operation independently

### Decision: Description stored in parent index

Descriptions are stored in the parent category's `index.yaml` under the subcategory entry, not in the category's own index.

**Rationale:**

- Matches existing subcategory metadata pattern (`memoryCount`)
- Enables listing subcategories with descriptions in a single index read
- No new files needed

## Risks / Trade-offs

| Risk                                                      | Mitigation                                    |
| --------------------------------------------------------- | --------------------------------------------- |
| Port interface may need changes as we discover edge cases | Keep interface minimal; add methods as needed |
| Two-layer pattern (core + MCP) adds complexity            | Clear documentation; consistent pattern       |
| Root category detection relies on path parsing            | Well-tested utility function                  |

## Migration Plan

1. No migration needed - new functionality only
2. Existing `index.yaml` files remain valid (description field is optional)
3. Can be rolled back by removing new code; no data format changes

## Open Questions

- Should `deleteCategory` require confirmation or have a `force` parameter? (Current: no confirmation)
- Should we add a `getCategory` operation to retrieve category metadata? (Current: use `list_memories`)
