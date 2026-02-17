# Add Category Hierarchy Configuration Implementation Plan

**Goal:** Add config-level category hierarchy definitions with mode-based enforcement to stores
**Architecture:** Extend store config parsing to support `categoryMode` and `categories` fields, update StoreInfo types to expose this metadata, and modify MCP responses to include hierarchy information
**Tech Stack:** TypeScript, Bun, Zod validation
**Session Id:** add-category-hierarchy-config

---

## Overview

This change adds:

1. `categoryMode` field to store config (`free | subcategories | strict`)
2. `categories` field with recursive nested hierarchy definitions
3. Helper functions to flatten and query config-defined categories
4. Updated MCP responses to include hierarchy from config (not disk state)

## Task Dependency Map

```
Task 1 (Config Schema) ─────────────────┐
                                        ├──> Task 3 (MCP Store Resources)
Task 2 (Store Metadata/Helpers) ────────┘
                                        │
                                        v
                                Task 4 (Documentation)
```

- Tasks 1 and 2 can run in **parallel** (no inter-dependencies)
- Task 3 depends on Tasks 1 and 2 (needs types and helpers)
- Task 4 (documentation) runs after all implementation is complete

---

## Task 1: Config Schema (packages/core/src/config.ts)

### 1.1 Define CategoryMode type

**File:** `packages/core/src/config.ts`

Add the type definition:

```typescript
/**
 * Category creation/deletion mode for a store.
 *
 * - `free` - Categories can be freely created/deleted (default)
 * - `subcategories` - Only subcategories of config-defined categories allowed
 * - `strict` - Only config-defined categories allowed
 */
export type CategoryMode = 'free' | 'subcategories' | 'strict';
```

### 1.2 Define CategoryDefinition type (recursive)

**File:** `packages/core/src/config.ts`

Add the recursive type definition:

```typescript
/**
 * Recursive category definition for config-defined hierarchies.
 *
 * Each category can have an optional description and nested subcategories.
 * The key is the category slug (lowercase kebab-case).
 */
export interface CategoryDefinition {
    /** Category description (max 500 chars) */
    description?: string;
    /** Nested subcategory definitions */
    subcategories?: Record<string, CategoryDefinition>;
}

/**
 * Category hierarchy as defined in store config.
 * Maps category slugs to their definitions.
 */
export type CategoryHierarchy = Record<string, CategoryDefinition>;
```

### 1.3 Update store config schema in parseMergedConfig

**File:** `packages/core/src/config.ts`

Update the `ConfigFileContent` interface and parsing logic:

```typescript
interface ConfigFileContent {
    settings?: Partial<ConfigSettings>;
    stores?: Record<
        string,
        {
            path: string;
            description?: string;
            categoryMode?: string; // NEW
            categories?: Record<string, unknown>; // NEW - raw parsed YAML
        }
    >;
}
```

Update `StoreDefinition` in `packages/core/src/store/registry.ts`:

```typescript
export interface StoreDefinition {
    path: string;
    description?: string;
    categoryMode?: CategoryMode; // NEW
    categories?: CategoryHierarchy; // NEW
}
```

### 1.4 Implement config parsing for nested category hierarchies

**File:** `packages/core/src/config.ts`

Add validation function:

```typescript
/**
 * Validates a category definition from config.
 *
 * @param def - Raw category definition from YAML
 * @param path - Current path for error messages
 * @returns Result with validated CategoryDefinition or error
 */
const validateCategoryDefinition = (
    def: unknown,
    path: string
): Result<CategoryDefinition, ConfigValidationError> => {
    if (
        def === null ||
        def === undefined ||
        (typeof def === 'object' && Object.keys(def as object).length === 0)
    ) {
        // Empty definition is valid (no description, no subcategories)
        return ok({});
    }

    if (typeof def !== 'object') {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: `Category '${path}' definition must be an object.`,
            field: path,
        });
    }

    const rawDef = def as Record<string, unknown>;
    const result: CategoryDefinition = {};

    // Validate description
    if (rawDef.description !== undefined) {
        if (typeof rawDef.description !== 'string') {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: `Category '${path}' description must be a string.`,
                field: `${path}.description`,
            });
        }
        if (rawDef.description.length > 500) {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: `Category '${path}' description exceeds 500 characters.`,
                field: `${path}.description`,
            });
        }
        result.description = rawDef.description;
    }

    // Validate subcategories recursively
    if (rawDef.subcategories !== undefined) {
        if (typeof rawDef.subcategories !== 'object' || rawDef.subcategories === null) {
            return err({
                code: 'CONFIG_VALIDATION_FAILED',
                message: `Category '${path}' subcategories must be an object.`,
                field: `${path}.subcategories`,
            });
        }

        const subcats: CategoryHierarchy = {};
        for (const [name, subDef] of Object.entries(rawDef.subcategories)) {
            const subPath = path ? `${path}/${name}` : name;
            const subResult = validateCategoryDefinition(subDef, subPath);
            if (!subResult.ok()) {
                return subResult;
            }
            subcats[name] = subResult.value;
        }
        result.subcategories = subcats;
    }

    return ok(result);
};

/**
 * Validates a category hierarchy from config.
 */
const validateCategoryHierarchy = (
    raw: unknown,
    storeName: string
): Result<CategoryHierarchy, ConfigValidationError> => {
    if (raw === null || raw === undefined) {
        return ok({});
    }

    if (typeof raw !== 'object') {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: `Store '${storeName}' categories must be an object.`,
            store: storeName,
            field: 'categories',
        });
    }

    const hierarchy: CategoryHierarchy = {};
    for (const [name, def] of Object.entries(raw as Record<string, unknown>)) {
        const result = validateCategoryDefinition(def, name);
        if (!result.ok()) {
            return err({
                ...result.error,
                store: storeName,
            });
        }
        hierarchy[name] = result.value;
    }

    return ok(hierarchy);
};
```

### 1.5 Add validation for categoryMode

In `parseMergedConfig`, add validation:

```typescript
// Validate categoryMode
const validModes: CategoryMode[] = ['free', 'subcategories', 'strict'];
if (def.categoryMode !== undefined && !validModes.includes(def.categoryMode as CategoryMode)) {
    return err({
        code: 'CONFIG_VALIDATION_FAILED',
        message: `Store '${name}' has invalid categoryMode: '${def.categoryMode}'. Must be 'free', 'subcategories', or 'strict'.`,
        store: name,
        field: 'categoryMode',
    });
}
```

### 1.6 Write unit tests for config parsing with hierarchies

**File:** `packages/core/src/config.spec.ts`

Add test cases:

- Parse store with categoryMode
- Default categoryMode when omitted
- Invalid categoryMode value
- Parse store with category hierarchy
- Category without description
- Deeply nested categories
- Category description too long (>500 chars)

---

## Task 2: Store Metadata Helpers (packages/core/src/config.ts)

### 2.1 Update StoreInfo type

**File:** `packages/server/src/store/tools.ts`

Update the `StoreInfo` interface:

```typescript
/**
 * Information about a single store.
 */
export interface StoreInfo {
    /** Name of the store */
    name: string;
    /** Path to the store directory */
    path: string;
    /** Optional description of the store */
    description?: string;
    /** Category creation mode (default: 'free') */
    categoryMode: CategoryMode;
    /** Config-defined category hierarchy */
    categories: FlattenedCategory[];
}

/**
 * Flattened category with full path and metadata.
 */
export interface FlattenedCategory {
    /** Full category path (e.g., "standards/architecture") */
    path: string;
    /** Optional description */
    description?: string;
    /** Immediate subcategories */
    subcategories: FlattenedCategory[];
}
```

### 2.2 Implement helper to flatten nested categories

**File:** `packages/core/src/config.ts`

````typescript
/**
 * Flattened category representation for API responses.
 */
export interface FlattenedCategory {
    /** Full category path */
    path: string;
    /** Category description */
    description?: string;
    /** Immediate subcategories (flattened) */
    subcategories: FlattenedCategory[];
}

/**
 * Flattens a nested category hierarchy into an array of paths with metadata.
 *
 * @param hierarchy - The nested category hierarchy from config
 * @param parentPath - Parent path prefix (empty for root)
 * @returns Array of flattened categories
 *
 * @example
 * ```typescript
 * const hierarchy = {
 *     standards: {
 *         description: 'Coding standards',
 *         subcategories: { architecture: { description: 'Arch decisions' } }
 *     }
 * };
 * const flattened = flattenCategories(hierarchy);
 * // [{ path: 'standards', description: 'Coding standards', subcategories: [
 * //     { path: 'standards/architecture', description: 'Arch decisions', subcategories: [] }
 * // ]}]
 * ```
 */
export const flattenCategories = (
    hierarchy: CategoryHierarchy,
    parentPath: string = ''
): FlattenedCategory[] => {
    return Object.entries(hierarchy).map(([name, def]) => {
        const path = parentPath ? `${parentPath}/${name}` : name;
        return {
            path,
            ...(def.description !== undefined && { description: def.description }),
            subcategories: def.subcategories ? flattenCategories(def.subcategories, path) : [],
        };
    });
};
````

### 2.3 Implement helper to check if category path is config-defined

**File:** `packages/core/src/config.ts`

````typescript
/**
 * Collects all paths in a category hierarchy, including implicit ancestors.
 *
 * @param hierarchy - The category hierarchy
 * @param parentPath - Parent path prefix
 * @returns Set of all valid category paths
 */
const collectAllPaths = (hierarchy: CategoryHierarchy, parentPath: string = ''): Set<string> => {
    const paths = new Set<string>();

    for (const [name, def] of Object.entries(hierarchy)) {
        const fullPath = parentPath ? `${parentPath}/${name}` : name;
        paths.add(fullPath);

        // Add all ancestor paths (implicit config-defined)
        const segments = fullPath.split('/');
        for (let i = 1; i < segments.length; i++) {
            paths.add(segments.slice(0, i).join('/'));
        }

        // Recurse into subcategories
        if (def.subcategories) {
            for (const subPath of collectAllPaths(def.subcategories, fullPath)) {
                paths.add(subPath);
            }
        }
    }

    return paths;
};

/**
 * Checks if a category path is defined in config (explicitly or as ancestor).
 *
 * @param hierarchy - The category hierarchy from store config
 * @param categoryPath - The path to check (e.g., "standards/architecture")
 * @returns true if the path is config-defined or an ancestor of a defined path
 *
 * @example
 * ```typescript
 * const hierarchy = { standards: { subcategories: { architecture: {} } } };
 * isConfigDefined(hierarchy, 'standards/architecture'); // true
 * isConfigDefined(hierarchy, 'standards'); // true (ancestor)
 * isConfigDefined(hierarchy, 'legacy'); // false
 * ```
 */
export const isConfigDefined = (hierarchy: CategoryHierarchy, categoryPath: string): boolean => {
    const allPaths = collectAllPaths(hierarchy);
    return allPaths.has(categoryPath);
};
````

---

## Task 3: MCP Store Resources

### 3.1 Update listStoresHandler response

**File:** `packages/server/src/store/tools.ts`

Update the handler to include hierarchy from config:

```typescript
export const listStoresHandler = async (ctx: ToolContext): Promise<StoreToolResponse> => {
    const registry = ctx.cortex.getRegistry();
    const stores: StoreInfo[] = Object.entries(registry)
        .map(([name, definition]) => ({
            name,
            path: definition.path,
            ...(definition.description !== undefined && { description: definition.description }),
            categoryMode: definition.categoryMode ?? 'free',
            categories: definition.categories ? flattenCategories(definition.categories) : [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return {
        content: [{ type: 'text', text: JSON.stringify({ stores }, null, 2) }],
    };
};
```

### 3.2 Update store detail resource

**File:** `packages/server/src/store/resources.ts`

Update the resource to include categoryMode and hierarchy:

```typescript
// In the store detail resource handler
return {
    contents: [
        {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
                name: storeName,
                categoryMode: storeDefinition.categoryMode ?? 'free',
                categories: storeDefinition.categories
                    ? flattenCategories(storeDefinition.categories)
                    : [],
            }),
        },
    ],
};
```

### 3.3 Write integration tests

**File:** `packages/server/src/store/tools.spec.ts`

Add test cases:

- list_stores response includes categoryMode and categories
- Store with category hierarchy returns flattened categories
- Store in free mode with no defined categories

**File:** `packages/server/src/store/resources.spec.ts`

Add test cases:

- Store detail resource includes categoryMode
- Store with category hierarchy in resource response
- Store without category config returns empty array

---

## Task 4: Documentation

### 4.1 Add JSDoc to all new exports

Ensure all new types and functions have complete JSDoc with:

- `@module` tag
- `@param` descriptions
- `@returns` description
- `@example` blocks
- Edge case documentation

### 4.2 Update serializeMergedConfig

Update the serializer to handle categoryMode and categories when round-tripping configs.

---

## Testing Strategy

All tests should follow the project conventions:

- Colocated `*.spec.ts` files
- `describe` per function, `it("should {behavior}")`
- Test both success and error cases
- Use real temp directories, no global mocking
- Use Result assertions: `expect(result.ok()).toBe(true)`

---

## Files Modified

**packages/core/src/config.ts:**

- Add `CategoryMode` type
- Add `CategoryDefinition` interface
- Add `CategoryHierarchy` type
- Add `FlattenedCategory` interface
- Add `flattenCategories()` function
- Add `isConfigDefined()` function
- Update `parseMergedConfig()` to validate new fields
- Update `serializeMergedConfig()` to handle new fields

**packages/core/src/store/registry.ts:**

- Update `StoreDefinition` interface

**packages/server/src/store/tools.ts:**

- Update `StoreInfo` interface
- Update `listStoresHandler()`

**packages/server/src/store/resources.ts:**

- Update store detail resource handler

**packages/core/src/config.spec.ts:**

- Add tests for category hierarchy parsing

**packages/server/src/store/tools.spec.ts:**

- Add tests for updated response shapes

**packages/server/src/store/resources.spec.ts:**

- Add tests for updated resource responses

---

## Breaking Changes

- **BREAKING**: `list_stores` response shape changes:
    - Each store now includes `categoryMode` (string, default "free")
    - Each store now includes `categories` (array, possibly empty)
- **BREAKING**: `cortex://store/{name}` resource response changes:
    - Now includes `categoryMode` and `categories` instead of disk-based category listing
