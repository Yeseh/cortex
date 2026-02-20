/**
 * Shared test helpers for category operation tests.
 *
 * Provides mock factory and result constructors used across
 * all category operation spec files.
 *
 * @module core/category/operations/_test-helpers
 */

import { mock } from 'bun:test';
import type { CategoryAdapter } from '@/storage/category-adapter.ts';
import { ok, err } from '../../result.ts';

// ============================================================================
// Mock Storage Factory
// ============================================================================

/**
 * Creates a mock CategoryStorage with sensible defaults.
 *
 * All methods default to returning successful results.
 * Override individual methods via the `overrides` parameter.
 *
 * @param overrides - Partial overrides for storage methods
 * @returns A fully-typed CategoryStorage mock
 *
 * @example
 * ```typescript
 * const storage = createMockStorage({
 *     exists: mock(async () => ok(true)),
 * });
 * ```
 */
export const createMockStorage = (
    overrides: Partial<CategoryAdapter> & Partial<{
        updateSubcategoryDescription: CategoryAdapter['setDescription'];
        removeSubcategoryEntry: CategoryAdapter['setDescription'];
    }> = {},
): CategoryAdapter => ({
    exists: mock(async () => ok(false)),
    ensure: mock(async () => ok(undefined)),
    delete: mock(async () => ok(undefined)),
    setDescription: (
        overrides.setDescription
        ?? overrides.updateSubcategoryDescription
        ?? overrides.removeSubcategoryEntry
        ?? mock(async () => ok(undefined))
    ),
    ...overrides,
});

// Re-export for convenience in tests
export { ok, err };
