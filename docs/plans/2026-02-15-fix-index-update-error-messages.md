# Fix Index Update Error Messages Implementation Plan

**Goal:** Improve error messages when index updates fail so users understand what went wrong and how to fix it
**Architecture:** Enhance error context propagation from storage-fs through core to CLI, with actionable error messages
**Tech Stack:** TypeScript, Bun, Result types
**Session Id:** ses_39f27c366ffew67iOffofX65Wo

---

## Problem Analysis

### Current Behavior

When index updates fail, users see generic error messages like:

```
Error: Failed to update indexes
```

This is unhelpful because:

1. It doesn't say _which_ index failed (root, category, subcategory)
2. It doesn't say _why_ it failed (parse error, write error, serialization error)
3. The underlying error details in `cause` are not surfaced to users
4. Users don't know if the operation partially succeeded (memory written but index not updated)

### Root Cause

In `packages/core/src/memory/operations/create.ts` (line 99) and `update.ts` (line 155):

```typescript
return memoryError('STORAGE_ERROR', 'Failed to update indexes', {
    cause: indexResult.error,
});
```

The `cause` contains useful information but the message is generic. The CLI then displays only `error.message`.

### Expected Behavior

Error messages should:

1. Include the memory path being operated on
2. Include specific failure reason from the underlying storage error
3. Suggest remediation (e.g., "Run `cortex store reindex` to rebuild indexes")
4. Distinguish between complete failure and partial success

---

## Implementation Tasks

### 1. Improve Core Error Messages (Implementation)

#### 1.1 Update `createMemory` error message

**File:** `packages/core/src/memory/operations/create.ts`

**Current (line 97-102):**

```typescript
const indexResult = await storage.indexes.updateAfterMemoryWrite(memory);
if (!indexResult.ok()) {
    return memoryError('STORAGE_ERROR', 'Failed to update indexes', {
        cause: indexResult.error,
    });
}
```

**Change to:**

```typescript
const indexResult = await storage.indexes.updateAfterMemoryWrite(memory);
if (!indexResult.ok()) {
    const reason = indexResult.error.message ?? 'Unknown error';
    return memoryError(
        'STORAGE_ERROR',
        `Memory written but index update failed for "${path}": ${reason}. ` +
            `Run "cortex store reindex" to rebuild indexes.`,
        {
            path,
            cause: indexResult.error,
        }
    );
}
```

#### 1.2 Update `updateMemory` error message

**File:** `packages/core/src/memory/operations/update.ts`

**Current (line 152-158):**

```typescript
const indexResult = await storage.indexes.updateAfterMemoryWrite(updatedMemory);
if (!indexResult.ok()) {
    return memoryError('STORAGE_ERROR', 'Failed to update indexes', {
        cause: indexResult.error,
    });
}
```

**Change to:**

```typescript
const indexResult = await storage.indexes.updateAfterMemoryWrite(updatedMemory);
if (!indexResult.ok()) {
    const reason = indexResult.error.message ?? 'Unknown error';
    return memoryError(
        'STORAGE_ERROR',
        `Memory updated but index update failed for "${slugPath}": ${reason}. ` +
            `Run "cortex store reindex" to rebuild indexes.`,
        {
            path: slugPath,
            cause: indexResult.error,
        }
    );
}
```

#### 1.3 Update `moveMemory` error message (if applicable)

**File:** `packages/core/src/memory/operations/move.ts`

Check if move operation has similar generic error messages.

#### 1.4 Update tests to expect new error messages

**Files:**

- `packages/core/src/memory/operations/create.spec.ts`
- `packages/core/src/memory/operations/update.spec.ts`
- `packages/core/src/memory/operations/move.spec.ts` (if applicable)

Update test expectations for error messages.

---

### 2. Improve Storage-FS Error Messages (Implementation)

#### 2.1 Review `updateCategoryIndexes` error messages

**File:** `packages/storage-fs/src/indexes.ts`

Ensure error messages from `upsertMemoryEntry`, `upsertSubcategoryEntry`, and `readCategoryIndex` include actionable context.

**Current pattern (e.g., line 156-160):**

```typescript
return err({
    code: 'INDEX_ERROR',
    message: `Category index not found at ${name}.`,
    path: name.toString(),
});
```

These are already reasonably descriptive. Focus on ensuring `updateCategoryIndexesFromMemory` passes through context properly.

#### 2.2 Improve `updateCategoryIndexesFromMemory` error context

**File:** `packages/storage-fs/src/indexes.ts` (line 375-399)

Add more context to serialization failure:

```typescript
if (!serialized.ok()) {
    return err({
        code: 'INDEX_ERROR',
        message: `Failed to serialize memory "${slugPath}" for index update: ${serialized.error.message ?? 'unknown error'}.`,
        path: slugPath,
        cause: serialized.error,
    });
}
```

---

### 3. Testing Tasks

#### 3.1 Add test for improved createMemory error message

**File:** `packages/core/src/memory/operations/create.spec.ts`

Add test case that verifies:

- Error message includes the memory path
- Error message includes underlying error reason
- Error message includes remediation suggestion

#### 3.2 Add test for improved updateMemory error message

**File:** `packages/core/src/memory/operations/update.spec.ts`

Similar test case for update operation.

#### 3.3 Run full test suite

Verify all existing tests still pass.

---

### 4. Verification

#### 4.1 Manual testing

1. Simulate index write failure (e.g., read-only directory)
2. Verify error message is helpful and actionable
3. Verify the reindex suggestion works

#### 4.2 Run linting and type checking

```bash
bun run lint
bun run typecheck
```

---

## Task Dependencies

```
1.1 createMemory error → 3.1 test for createMemory
1.2 updateMemory error → 3.2 test for updateMemory
1.3 moveMemory error → (check if needed)
2.1 storage-fs review → 2.2 improve context
All tasks → 3.3 full test suite → 4.1 manual test → 4.2 lint/typecheck
```

## Parallelization

- Tasks 1.1, 1.2, 1.3 can run in parallel
- Tasks 2.1, 2.2 can run in parallel with tasks 1.x
- Testing tasks (3.x) must wait for implementation tasks

## Estimated Effort

- Implementation: ~30 minutes
- Testing: ~15 minutes
- Review/Polish: ~15 minutes
- Total: ~1 hour
