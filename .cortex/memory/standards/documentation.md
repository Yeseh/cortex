---
created_at: 2026-01-27T20:20:50.869Z
updated_at: 2026-01-27T20:20:50.869Z
tags: [jsdoc, comments, documentation]
source: mcp
---
Every exported function MUST have comprehensive JSDoc comments including:

1. **Module-level `@module` tag** at file top
2. **Function description** explaining purpose and constraints
3. **`@param` tags** for all parameters
4. **`@returns` description** with error conditions
5. **`@example` blocks** showing typical usage
6. **Edge case documentation** in prose explaining boundary conditions

**Example:**
```typescript
/**
 * Creates a category and its parent hierarchy, excluding root categories.
 *
 * This function implements idempotent category creation:
 * - If the category exists, returns success with `created: false`
 * - If the category doesn't exist, creates it and any missing ancestors
 * - Root categories are assumed to exist (not created automatically)
 *
 * @param storage - Storage port for persistence operations
 * @param path - Category path to create (e.g., "project/cortex/api")
 * @returns Result with creation details or error
 *
 * @example
 * ```typescript
 * const result = await createCategory(storage, 'project/cortex/api');
 * if (result.ok) {
 *   console.log(result.value.created ? 'Created' : 'Already existed');
 * }
 * ```
 */
```