---
created_at: 2026-01-28T18:54:38.464Z
updated_at: 2026-01-28T18:54:38.464Z
tags: [architecture, patterns, storage, filesystem]
source: mcp
---
# Cortex Architecture Patterns

## Module Structure Pattern
The Cortex codebase prefers modular organization following the pattern demonstrated in `src/core/storage/filesystem/`:
- `types.ts` - Type definitions and interfaces
- `utils.ts` - Shared utility functions
- Focused operation files (e.g., `files.ts`, `indexes.ts`, `categories.ts`)
- `index.ts` - Barrel export + facade class that composes the modules

## Facade Pattern
Large adapters should use a facade pattern where:
- Internal modules handle specific concerns (single responsibility)
- A facade class composes all modules and implements the public interface
- Consumers import only from the index/facade

## Error Handling
- Use `Result<T, E>` types consistently for error handling
- Define specific error types per module
- Propagate errors up the call chain without throwing

## Referenced in
- refactor-filesystem-storage proposal (archived 2026-01-28)