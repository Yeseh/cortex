# Add Category Hierarchy Configuration Implementation Plan

**Goal:** Add category mode and hierarchy configuration to store definitions, enabling users to define protected category structures.
**Architecture:** Extend `StoreDefinition` type with `categoryMode` and `categories` fields. Parse nested YAML hierarchy into recursive `CategoryDefinition` type. Update `list_stores` and store resources to include hierarchy from config.
**Tech Stack:** TypeScript 5.x, Bun, Zod validation
**Session Id:** ses_38f517632ffeUzeXtLbNpD2OJq

---

## Dependencies

All implementation tasks depend on core types being defined first. The dependency graph:

- 1.1-1.2 (types) → 1.3-1.5 (schema/parsing) → 2.1-2.3 (helpers)
- 2.1-2.3 (helpers) → 3.1-3.2 (MCP updates)
- All implementation → 1.6, 3.3 (tests)

Parallelization:

- 1.1 and 1.2 can run in parallel
- 2.2 and 2.3 can run in parallel (after 2.1)
- 3.1 and 3.2 can run in parallel (after 2.x)
- Tests (1.6, 3.3) run after implementation complete

---

## Phase 1: Config Schema (packages/core)

### Task 1.1: Define CategoryMode type

**File:** `packages/core/src/config.ts`

Add the `CategoryMode` type:

```typescript
/**
 * Category creation/deletion mode for a store.
 * - `free` - Categories can be created/deleted freely (default)
 * - `subcategories` - Only subcategories of config-defined categories allowed
 * - `strict` - Only config-defined categories allowed
 */
export type CategoryMode = 'free' | 'subcategories' | 'strict';
```

### Task 1.2: Define CategoryDefinition type

**File:** `packages/core/src/config.ts`

Add recursive type for category hierarchy:

```typescript
/**
 * Definition of a category in the store configuration.
 * Supports arbitrary nesting depth via subcategories.
 */
export interface CategoryDefinition {
    /** Optional description (max 500 chars) */
    description?: string;
    /** Nested subcategories */
    subcategories?: Record<string, CategoryDefinition>;
}
```

### Task 1.3: Update StoreDefinition and parsing

**File:** `packages/core/src/store/registry.ts`

Update `StoreDefinition` interface:

```typescript
export interface StoreDefinition {
    path: string;
    description?: string;
    categoryMode?: CategoryMode;
    categories?: Record<string, CategoryDefinition>;
}
```

### Task 1.4: Implement config parsing for nested hierarchies

**File:** `packages/core/src/config.ts`

Update `parseMergedConfig` to handle:

- `categoryMode` field with validation (free|subcategories|strict)
- `categories` field with recursive parsing
- Pass through to `StoreDefinition`

Key validation:

- categoryMode must be one of: 'free', 'subcategories', 'strict'
- Each category description must be ≤500 characters
- Empty object `{}` is valid (no description, no subcategories)

### Task 1.5: Add validation for category definitions

**File:** `packages/core/src/config.ts`

Add helper to validate category definitions recursively:

```typescript
const validateCategoryDefinition = (
    def: unknown,
    path: string,
    storeName: string,
): Result<CategoryDefinition, ConfigValidationError>
```

Checks:

- Description is string and ≤500 chars
- Subcategories are objects
- Recursively validates nested definitions

### Task 1.6: Write unit tests

**File:** `packages/core/src/config.spec.ts`

Test cases:

- Parse store with explicit categoryMode
- Parse store without categoryMode (defaults to 'free')
- Reject invalid categoryMode value
- Parse store with nested category hierarchy
- Parse category without description
- Parse deeply nested categories
- Reject description >500 chars
- Round-trip with categories and categoryMode

---

## Phase 2: Store Metadata (packages/core)

### Task 2.1: Update StoreInfo type

**File:** `packages/server/src/store/tools.ts`

Extend `StoreInfo` with hierarchy info:

```typescript
/**
 * Information about a category in the hierarchy.
 */
export interface CategoryInfo {
    /** Full path (e.g., "standards/architecture") */
    path: string;
    /** Optional description */
    description?: string;
    /** Nested subcategories */
    subcategories: CategoryInfo[];
}

/**
 * Information about a single store.
 */
export interface StoreInfo {
    name: string;
    path: string;
    description?: string;
    categoryMode: CategoryMode;
    categories: CategoryInfo[];
}
```

### Task 2.2: Implement flattenCategories helper

**File:** `packages/core/src/config.ts` (or new file)

```typescript
/**
 * Flattens nested CategoryDefinition hierarchy to array of paths.
 */
export const flattenCategoryPaths = (
    categories: Record<string, CategoryDefinition>,
    prefix = '',
): string[]
```

### Task 2.3: Implement isConfigDefined helper

**File:** `packages/core/src/config.ts` (or new file)

```typescript
/**
 * Checks if a category path is defined in config.
 * Ancestors of explicitly defined categories are implicitly config-defined.
 */
export const isConfigDefined = (
    path: string,
    categories: Record<string, CategoryDefinition>,
): boolean
```

---

## Phase 3: MCP Store Resources (packages/server)

### Task 3.1: Update list_stores response

**File:** `packages/server/src/store/tools.ts`

Update `listStoresHandler` to:

1. Read categoryMode from StoreDefinition (default 'free')
2. Convert categories Record to CategoryInfo[] recursively
3. Include in response

### Task 3.2: Update cortex://store/{name} resource

**File:** `packages/server/src/store/resources.ts`

Update store detail response to include:

- `categoryMode`
- `categories` array with full hierarchy

### Task 3.3: Write integration tests

**File:** `packages/server/src/store/tools.spec.ts` and `resources.spec.ts`

Test cases:

- list_stores includes categoryMode and categories
- list_stores with free mode and empty categories
- list_stores with nested category hierarchy
- Store detail resource includes categoryMode
- Store detail resource includes category hierarchy

---

## Phase 4: Documentation

### Task 4.1-4.2: Update docs

- Add example config.yaml with categories
- Document category hierarchy schema
- Note BREAKING change to list_stores response shape

---

## File Summary

| File                                          | Changes                                                    |
| --------------------------------------------- | ---------------------------------------------------------- |
| `packages/core/src/config.ts`                 | Add CategoryMode, CategoryDefinition types; update parsing |
| `packages/core/src/config.spec.ts`            | Add tests for hierarchy parsing                            |
| `packages/core/src/store/registry.ts`         | Update StoreDefinition                                     |
| `packages/server/src/store/tools.ts`          | Update StoreInfo, CategoryInfo, handlers                   |
| `packages/server/src/store/tools.spec.ts`     | Add integration tests                                      |
| `packages/server/src/store/resources.ts`      | Update store detail response                               |
| `packages/server/src/store/resources.spec.ts` | Add resource tests                                         |

---

## Verification Commands

```bash
# Type check
bunx tsc --build

# Run tests
bun test packages

# Lint
bunx eslint packages/*/src/**/*.ts --fix
```
