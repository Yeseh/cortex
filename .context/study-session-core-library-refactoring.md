# Study Session: Core Library Refactoring Guide

**Date:** 2026-01-27  
**Purpose:** Reference guide for refactoring core library modules to follow established architectural patterns

---

## Overview

This guide documents the patterns and standards for Cortex core library modules. Use it when reviewing or refactoring modules in `src/core/`.

## Before Starting: Load Context

### Memory to Load

```
# Load all project standards
cortex_list_memories(category: "projects/cortex/standards")

# Key standards to read:
cortex_get_memory(path: "projects/cortex/standards/core-module-architecture")
cortex_get_memory(path: "projects/cortex/standards/types-vs-interfaces")
cortex_get_memory(path: "projects/cortex/standards/barrel-exports")
cortex_get_memory(path: "projects/cortex/standards/documentation")
cortex_get_memory(path: "projects/cortex/standards/self-documenting-errors")
cortex_get_memory(path: "projects/cortex/standards/result-types")
cortex_get_memory(path: "projects/cortex/standards/function-signatures")
cortex_get_memory(path: "projects/cortex/standards/testing")
cortex_get_memory(path: "projects/cortex/standards/module-checklist")
cortex_get_memory(path: "projects/cortex/standards/file-organization")
```

### Reference Implementation

The `src/core/category/` module is the gold standard. Review its structure:

```
src/core/category/
├── index.ts           # Barrel exports with explicit type/value separation
├── types.ts           # Port interface, error codes, result types
├── operations.ts      # Pure business logic functions
└── operations.spec.ts # Unit tests with mock factory
```

---

## Checklist: What to Look For

### 1. Module Structure

- [ ] Has `index.ts` barrel export?
- [ ] Has `types.ts` with port interface and error types?
- [ ] Has `operations.ts` with business logic (if applicable)?
- [ ] If `operations.ts` > 500 lines, are operations split into separate files?
- [ ] Test files colocated as `{filename}.spec.ts`?

### 2. Type Definitions

- [ ] Uses `type` for data structures (not `interface`)?
- [ ] Uses `interface` only for contracts/ports?
- [ ] Error types are discriminated unions with `code` field?
- [ ] Result types defined per operation?

**Pattern:**

```typescript
// Data structures - use type
export type MemoryMetadata = {
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    source: string;
};

// Error codes - discriminated union
export type MemoryErrorCode = 'MEMORY_NOT_FOUND' | 'INVALID_PATH' | 'STORAGE_ERROR';

// Error details - use type
export type MemoryError = {
    code: MemoryErrorCode;
    message: string;
    path?: string;
    cause?: unknown;
};

// Contracts/ports - use interface
export interface MemoryStorage {
    read(path: string): Promise<Result<Memory | null, MemoryError>>;
}
```

### 3. Naming Conventions

- [ ] No implementation details leaked in names?
    - BAD: `MemoryFile`, `parseMemoryFile` (implies file storage)
    - GOOD: `Memory`, `parseFrontmatter` (abstract domain + specific format)
- [ ] Format/serialization adapters in separate `formats/` subdirectory?
- [ ] Port interfaces suffixed with `Storage` or `Port`?

### 4. Result Types & Error Handling

- [ ] Uses `ok`/`err` from `core/result.ts` (not local definitions)?
- [ ] All fallible operations return `Result<T, E>`?
- [ ] Error messages include actionable guidance?

**Pattern:**

```typescript
// Import from central location
import { ok, err } from '../result.ts';

// Actionable error messages
return err({
    code: 'CATEGORY_NOT_FOUND',
    message: `Category not found: ${path}. Create it first with createCategory('${path}') or check the path is correct.`,
    path,
});
```

### 5. Barrel Exports

- [ ] Types exported with `export type { ... }`?
- [ ] Values exported with `export { ... }`?
- [ ] Exports grouped logically (types first, then functions, then constants)?
- [ ] Port interfaces renamed with `as` for clarity?

**Pattern:**

```typescript
export type {
    MemoryErrorCode,
    MemoryError,
    Memory,
    MemoryMetadata,
    MemoryStorage as MemoryStoragePort,
} from './types.ts';

export { MAX_CONTENT_LENGTH } from './types.ts';

export { createMemory, updateMemory, deleteMemory } from './operations.ts';
```

### 6. Documentation

- [ ] File has `@module` JSDoc tag at top?
- [ ] All exported functions have JSDoc with `@param`, `@returns`, `@example`?
- [ ] Edge cases documented in prose?
- [ ] Constants have rationale in JSDoc?

### 7. Function Signatures

- [ ] Async operations take storage port as first parameter?
- [ ] Pure helpers are synchronous and don't take port?
- [ ] Return types explicitly declared?

**Pattern:**

```typescript
// Async operation with port
export const createMemory = async (
    storage: MemoryStorage,
    path: string,
    content: string,
): Promise<Result<CreateMemoryResult, MemoryError>> => { ... };

// Pure helper (no port, synchronous)
export const isValidPath = (path: string): boolean => { ... };
```

### 8. Testing

- [ ] Mock factory for port interface?
- [ ] Tests organized with `describe` blocks per function?
- [ ] Tests named "should {expected behavior}"?
- [ ] Both success and error paths tested?
- [ ] Edge cases tested (empty strings, boundaries)?

---

## Common Refactoring Patterns

### Separating Domain from Serialization

When a module mixes domain types with format-specific serialization:

**Before:**

```
src/core/memory/
├── file.ts              # Mixed: domain types + YAML parsing
└── memory.spec.ts
```

**After:**

```
src/core/memory/
├── index.ts             # Barrel exports
├── types.ts             # Domain types (Memory, MemoryMetadata)
├── validation.ts        # Path validation (if applicable)
├── validation.spec.ts
└── formats/
    ├── index.ts         # Format adapters barrel
    ├── frontmatter.ts   # YAML frontmatter format
    └── frontmatter.spec.ts
```

### Extracting Port Interfaces

When business logic is coupled to storage:

1. Identify storage operations used (read, write, exists, delete)
2. Create `interface XxxStorage` in `types.ts` with those methods
3. Move business logic to `operations.ts`, taking storage as first param
4. Create adapter implementing the interface in `storage/` directory

### Consolidating Local Helpers

When `ok`/`err` are defined locally in multiple files:

```typescript
// Before (in each file)
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// After (import from central location)
import { ok, err } from '../result.ts';
```

### Splitting Large Operations Files

When `operations.ts` grows beyond ~500 lines, split into separate files named after the operation:

**Before:**

```
src/core/{module}/
├── index.ts
├── types.ts
├── operations.ts      # 800+ lines, hard to navigate
└── operations.spec.ts
```

**After:**

```
src/core/{module}/
├── index.ts           # Re-exports from all operation files
├── types.ts
├── create.ts          # createXxx operation
├── create.spec.ts
├── delete.ts          # deleteXxx operation
├── delete.spec.ts
├── update.ts          # updateXxx operation
└── update.spec.ts
```

The barrel `index.ts` re-exports from all operation files, maintaining a unified public API.

---

## Module-Specific Notes

### `src/core/memory/`

**Issues identified:**

- `MemoryFile*` naming leaks file storage implementation
- No `index.ts` barrel export
- Local `ok`/`err` helpers instead of central imports
- `MemoryMetadata` in `core/types.ts` differs from `MemoryFileFrontmatter`
- Missing `@module` JSDoc tags
- Tests not split per file

**Refactoring:** See OpenSpec change `refactor-memory-module`

### `src/core/index/`

Review for same patterns (TBD)

### `src/core/store/`

Review for same patterns (TBD)

---

## Creating Change Proposals

When refactoring requires significant changes, create an OpenSpec proposal:

```bash
# 1. Check existing specs
openspec list --specs

# 2. Create change directory
mkdir -p openspec/changes/refactor-{module-name}/specs/{affected-capability}

# 3. Create proposal.md, tasks.md, and spec deltas

# 4. Validate
openspec validate refactor-{module-name} --strict --no-interactive
```

See `openspec/AGENTS.md` for full workflow.
