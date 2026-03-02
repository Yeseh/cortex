# Add Category Mode Enforcement Implementation Plan

**Goal:** Enforce category mode permissions (free/subcategories/strict) in category operations and conditionally register MCP tools based on mode.
**Architecture:** Add `CategoryModeContext` to category operations, check mode/config-defined status before mutations, update memory creation to require existing categories, conditionally register MCP tools.
**Tech Stack:** TypeScript, Bun, MCP SDK, Zod
**Session Id:** ses_38a3c4f20ffez8BI3C25pktoCZ

---

## Summary of Changes

### Breaking Changes

- `createMemory` no longer auto-creates categories (requires category to exist)
- Category operations now accept optional `CategoryModeContext` parameter

### New Error Codes

- `CATEGORY_PROTECTED` - Operation rejected on config-defined category
- `ROOT_CATEGORY_NOT_ALLOWED` - New root category rejected in subcategories mode
- `CATEGORY_NOT_FOUND` - Category doesn't exist (for memory creation)

### Files to Modify

| File                                                       | Changes                                     |
| ---------------------------------------------------------- | ------------------------------------------- |
| `packages/core/src/category/types.ts`                      | Add `CategoryModeContext`, new error codes  |
| `packages/core/src/category/operations/create.ts`          | Add mode enforcement                        |
| `packages/core/src/category/operations/delete.ts`          | Add config-defined protection               |
| `packages/core/src/category/operations/set-description.ts` | Add config-defined protection               |
| `packages/core/src/memory/operations/create.ts`            | Remove auto-create, require category exists |
| `packages/server/src/category/tools.ts`                    | Conditional registration, pass mode context |

---

## Phase 1: Core Category Types & Error Codes

### Task 1.1: Add CategoryModeContext and error codes

**File:** `packages/core/src/category/types.ts`

Add new error codes to `CategoryErrorCode`:

```typescript
export type CategoryErrorCode =
    | 'CATEGORY_NOT_FOUND'
    | 'ROOT_CATEGORY_REJECTED'
    | 'DESCRIPTION_TOO_LONG'
    | 'STORAGE_ERROR'
    | 'INVALID_PATH'
    | 'CATEGORY_PROTECTED' // NEW
    | 'ROOT_CATEGORY_NOT_ALLOWED'; // NEW
```

Add `CategoryModeContext` interface:

```typescript
import type { CategoryMode, CategoryDefinition } from '../config.ts';

/**
 * Context for category mode enforcement.
 *
 * When provided to category operations, enables mode-based
 * permission checks and config-defined category protection.
 */
export interface CategoryModeContext {
    /** Category creation/deletion mode */
    mode: CategoryMode;
    /** Config-defined category hierarchy (for protection checks) */
    configCategories?: Record<string, CategoryDefinition>;
}
```

Export from `packages/core/src/category/index.ts`.

---

## Phase 2: Category Operations Mode Enforcement

### Task 1.2: Update createCategory with mode enforcement

**File:** `packages/core/src/category/operations/create.ts`

Update signature to accept optional `CategoryModeContext`:

```typescript
export const createCategory = async (
    storage: CategoryStorage,
    path: string,
    modeContext?: CategoryModeContext,
): Promise<Result<CreateCategoryResult, CategoryError>> => {
```

Add mode checks after path validation:

```typescript
import { isConfigDefined } from '../../config.ts';

// If config-defined, return early (idempotent)
if (modeContext?.configCategories && isConfigDefined(path, modeContext.configCategories)) {
    // Check if exists - if so, return idempotent success
    const existsResult = await storage.exists(pathResult.value);
    if (existsResult.ok() && existsResult.value) {
        return ok({ path, created: false });
    }
    // Config-defined but doesn't exist on disk - still allow creation (bootstrap)
}

// In subcategories mode, reject new root categories
if (modeContext?.mode === 'subcategories') {
    const segments = path.split('/');
    const rootCategory = segments[0];
    // If root is not config-defined, reject
    if (rootCategory && !isConfigDefined(rootCategory, modeContext.configCategories)) {
        const allowedRoots = Object.keys(modeContext.configCategories ?? {});
        return err({
            code: 'ROOT_CATEGORY_NOT_ALLOWED',
            message:
                `Cannot create new root category '${rootCategory}' in subcategories mode. ` +
                `Allowed root categories: ${allowedRoots.join(', ') || 'none defined'}.`,
            path,
        });
    }
}

// In strict mode, reject any non-config-defined category
if (modeContext?.mode === 'strict') {
    if (!isConfigDefined(path, modeContext.configCategories)) {
        return err({
            code: 'CATEGORY_PROTECTED',
            message:
                `Cannot create category '${path}' in strict mode. ` +
                'Only config-defined categories are allowed. Update config.yaml to add new categories.',
            path,
        });
    }
}
```

### Task 1.3: Update deleteCategory with config protection

**File:** `packages/core/src/category/operations/delete.ts`

Update signature:

```typescript
export const deleteCategory = async (
    storage: CategoryStorage,
    path: string,
    modeContext?: CategoryModeContext,
): Promise<Result<DeleteCategoryResult, CategoryError>> => {
```

Add protection check after path validation:

```typescript
import { isConfigDefined } from '../../config.ts';

// Reject config-defined categories (protected)
if (modeContext?.configCategories && isConfigDefined(path, modeContext.configCategories)) {
    return err({
        code: 'CATEGORY_PROTECTED',
        message:
            `Cannot delete config-defined category '${path}'. ` +
            'Remove it from config.yaml first.',
        path,
    });
}

// Also check if this is an ancestor of any config-defined category
if (modeContext?.configCategories) {
    const allPaths = flattenCategoryPaths(modeContext.configCategories);
    const isAncestor = allPaths.some((configPath) => configPath.startsWith(path + '/'));
    if (isAncestor) {
        return err({
            code: 'CATEGORY_PROTECTED',
            message:
                `Cannot delete '${path}' because it contains config-defined subcategories. ` +
                'Remove subcategories from config.yaml first.',
            path,
        });
    }
}
```

### Task 1.4: Update setDescription with config protection

**File:** `packages/core/src/category/operations/set-description.ts`

Update signature:

```typescript
export const setDescription = async (
    storage: CategoryStorage,
    path: string,
    description: string,
    modeContext?: CategoryModeContext,
): Promise<Result<SetDescriptionResult, CategoryError>> => {
```

Add protection check:

```typescript
import { isConfigDefined } from '../../config.ts';

// Reject config-defined categories (descriptions come from config)
if (modeContext?.configCategories && isConfigDefined(path, modeContext.configCategories)) {
    return err({
        code: 'CATEGORY_PROTECTED',
        message:
            `Cannot set description on config-defined category '${path}'. ` +
            'Update the description in config.yaml instead.',
        path,
    });
}
```

---

## Phase 3: Memory Operations

### Task 2.1: Update createMemory to require category existence

**File:** `packages/core/src/memory/operations/create.ts`

Add category existence check before writing:

```typescript
import { CategoryPath } from '@/category/category-path.ts';

// Extract category path from memory path
const pathSegments = path.split('/');
if (pathSegments.length < 2) {
    return memoryError(
        'INVALID_PATH',
        `Memory path '${path}' must include at least one category. ` +
            'Example: "category/memory-name"',
        { path }
    );
}

const categoryPath = pathSegments.slice(0, -1).join('/');
const categoryPathResult = CategoryPath.fromString(categoryPath);
if (!categoryPathResult.ok()) {
    return memoryError('INVALID_PATH', `Invalid category path: ${categoryPath}`, { path });
}

// Check category exists
const categoryExists = await storage.categories.exists(categoryPathResult.value);
if (!categoryExists.ok()) {
    return memoryError('STORAGE_ERROR', `Failed to check category existence: ${categoryPath}`, {
        path,
        cause: categoryExists.error,
    });
}

if (!categoryExists.value) {
    return memoryError(
        'CATEGORY_NOT_FOUND',
        `Category '${categoryPath}' does not exist. ` +
            `Create it first with 'cortex category create ${categoryPath}'.`,
        { path }
    );
}
```

Add `CATEGORY_NOT_FOUND` to memory error codes in `packages/core/src/memory/result.ts`:

```typescript
export type MemoryErrorCode =
    | 'INVALID_PATH'
    | 'MEMORY_NOT_FOUND'
    | 'STORAGE_ERROR'
    | 'SERIALIZATION_ERROR'
    | 'CATEGORY_NOT_FOUND'; // NEW
```

---

## Phase 4: MCP Tool Registration

### Task 3.1: Update tool registration for conditional mode

**File:** `packages/server/src/category/tools.ts`

Update `registerCategoryTools` signature:

```typescript
import type { CategoryMode, CategoryDefinition } from '@yeseh/cortex-core';

export interface CategoryToolsOptions {
    /** Category mode for the store (affects which tools are registered) */
    mode?: CategoryMode;
    /** Config-defined categories (for protection checks) */
    configCategories?: Record<string, CategoryDefinition>;
}

export const registerCategoryTools = (
    server: McpServer,
    ctx: ToolContext,
    options?: CategoryToolsOptions
): void => {
    const mode = options?.mode ?? 'free';

    // In strict mode, don't register create/delete tools
    if (mode !== 'strict') {
        server.tool(
            'cortex_create_category'
            // ... existing registration
        );

        server.tool(
            'cortex_delete_category'
            // ... existing registration
        );
    }

    // set_category_description is always registered
    server.tool(
        'cortex_set_category_description'
        // ... existing registration
    );
};
```

### Task 3.2: Pass mode context to handlers

Update handlers to accept and use mode context:

```typescript
export const createCategoryHandler = async (
    ctx: ToolContext,
    input: CreateCategoryInput,
    modeContext?: CategoryModeContext
): Promise<McpToolResponse> => {
    // ... resolve adapter ...
    const result = await createCategory(port, input.path, modeContext);
    // ... handle result ...
};
```

---

## Phase 5: Unit Tests

### Task 1.5: Category operation mode tests

**File:** `packages/core/src/category/operations/create.spec.ts`

Add test cases:

- Creating category in free mode (no restrictions)
- Creating root category in subcategories mode (rejected)
- Creating subcategory in subcategories mode (allowed)
- Creating non-config category in strict mode (rejected)
- Creating config-defined category in strict mode (allowed)

**File:** `packages/core/src/category/operations/delete.spec.ts`

Add test cases:

- Deleting config-defined category (rejected with CATEGORY_PROTECTED)
- Deleting ancestor of config-defined category (rejected)
- Deleting non-config category (allowed)

**File:** `packages/core/src/category/operations/set-description.spec.ts`

Add test cases:

- Setting description on config-defined category (rejected)
- Setting description on non-config category (allowed)

### Task 2.2: Memory creation category tests

**File:** `packages/core/src/memory/operations/create.spec.ts`

Add test cases:

- Creating memory with existing category (succeeds)
- Creating memory with missing category (returns CATEGORY_NOT_FOUND)
- Creating memory with missing nested category (identifies correct missing path)

---

## Dependency Graph

```
Phase 1 (Types)
    └── Task 1.1: Add CategoryModeContext & error codes
            │
            ├── Phase 2 (Category Ops) - can parallelize
            │   ├── Task 1.2: createCategory mode enforcement
            │   ├── Task 1.3: deleteCategory config protection
            │   └── Task 1.4: setDescription config protection
            │
            └── Phase 3 (Memory Ops)
                └── Task 2.1: createMemory require category
                        │
                        └── Phase 4 (MCP)
                            ├── Task 3.1: Conditional registration
                            └── Task 3.2: Pass mode context
                                    │
                                    └── Phase 5 (Tests) - can parallelize
                                        ├── Task 1.5: Category tests
                                        ├── Task 2.2: Memory tests
                                        └── Task 3.3: MCP tests
```

## Verification

After each phase:

1. Run `bun test packages/core` to verify core changes
2. Run `bun test packages/server` to verify MCP changes
3. Run `bun typecheck` to verify type safety
