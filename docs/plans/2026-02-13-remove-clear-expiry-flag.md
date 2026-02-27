# Remove `clear_expiry` Boolean Flag Implementation Plan

**Goal:** Remove the `clearExpiry` / `clear_expiry` / `--clear-expiry` boolean flag anti-pattern from all layers, replacing it with a nullable `expiresAt` / `expires_at` field.
**Architecture:** Three-layer change (core → server → CLI). Core `UpdateMemoryInput.expiresAt` becomes `Date | null | undefined` (3-state: set/clear/keep). MCP schema makes `expires_at` nullable. CLI replaces `--clear-expiry` with Commander.js `--no-expires-at` negation flag.
**Tech Stack:** TypeScript, Zod, Commander.js, Bun test
**Session Id:** ses_3a7b734a0ffeMM50wViV8KuEIw

---

## Dependency Graph

```
Task 1 (Core interface + logic)
  ├── Task 2 (Core tests) ── can run in parallel with Task 1
  ├── Task 3 (Server schema + handler) ── depends on Task 1
  │     └── Task 4 (Server tests) ── can run in parallel with Task 3
  ├── Task 5 (CLI command) ── depends on Task 1
  │     └── Task 6 (CLI integration tests) ── can run in parallel with Task 5
  └── Task 7 (Acceptance script + spec) ── depends on Tasks 3, 5
```

## Task 1: Core — Update `UpdateMemoryInput` and `updateMemory()` logic

**Files:** `packages/core/src/memory/operations.ts`

### Step 1.1: Change `UpdateMemoryInput` interface

**Location:** `packages/core/src/memory/operations.ts`, lines 67-77

Replace:

```typescript
export interface UpdateMemoryInput {
    /** New content (undefined = keep existing) */
    content?: string;
    /** New tags (undefined = keep existing) */
    tags?: string[];
    /** New expiration (undefined = keep existing) */
    expiresAt?: Date;
    /** If true, removes expiration */
    clearExpiry?: boolean;
}
```

With:

```typescript
export interface UpdateMemoryInput {
    /** New content (undefined = keep existing) */
    content?: string;
    /** New tags (undefined = keep existing) */
    tags?: string[];
    /**
     * New expiration date.
     * - `Date` — set expiration to this date
     * - `null` — explicitly clear (remove) the expiration
     * - `undefined` (omitted) — keep the existing value unchanged
     */
    expiresAt?: Date | null;
}
```

### Step 1.2: Update `hasUpdates` check

**Location:** `packages/core/src/memory/operations.ts`, lines 526-530

Replace:

```typescript
const hasUpdates =
    updates.content !== undefined ||
    updates.tags !== undefined ||
    updates.expiresAt !== undefined ||
    updates.clearExpiry === true;
```

With:

```typescript
const hasUpdates =
    updates.content !== undefined || updates.tags !== undefined || updates.expiresAt !== undefined;
```

Note: `expiresAt === null` satisfies `!== undefined`, so both `Date` and `null` are detected as updates. No separate `clearExpiry` check needed.

### Step 1.3: Update merge logic

**Location:** `packages/core/src/memory/operations.ts`, lines 572-574

Replace:

```typescript
            expiresAt: updates.clearExpiry
                ? undefined
                : (updates.expiresAt ?? existing.metadata.expiresAt),
```

With:

```typescript
            expiresAt: updates.expiresAt === null
                ? undefined
                : (updates.expiresAt ?? existing.metadata.expiresAt),
```

### Step 1.4: Update JSDoc on `updateMemory()`

**Location:** `packages/core/src/memory/operations.ts`, line 504

Replace reference to `clearExpiry` with description of nullable `expiresAt`.

---

## Task 2: Core — Update tests

**Files:** `packages/core/src/memory/operations.spec.ts`

### Step 2.1: Update clear-expiry test

**Location:** `packages/core/src/memory/operations.spec.ts`, lines 514-527

Find the test `'should clear expiry with clearExpiry=true'` and change:

- Test name to `'should clear expiry with expiresAt=null'`
- The update input from `{ clearExpiry: true }` to `{ expiresAt: null }`
- Assertions remain the same (result metadata.expiresAt should be undefined)

### Step 2.2: Verify test passes

Run: `bun test packages/core/src/memory/operations.spec.ts`

---

## Task 3: Server — Update Zod schema, types, and handler

**Files:** `packages/server/src/memory/tools.ts`

### Step 3.1: Update `updateMemoryInputSchema`

**Location:** `packages/server/src/memory/tools.ts`, lines 78-85

Replace:

```typescript
export const updateMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    content: z.string().optional().describe('New memory content'),
    tags: tagsSchema.describe('New tags (replaces existing)'),
    expires_at: isoDateSchema.optional().describe('New expiration date (ISO 8601)'),
    clear_expiry: z.boolean().optional().default(false).describe('Remove expiration date'),
});
```

With:

```typescript
export const updateMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    content: z.string().optional().describe('New memory content'),
    tags: tagsSchema.describe('New tags (replaces existing)'),
    expires_at: isoDateSchema
        .optional()
        .nullable()
        .describe('New expiration date (ISO 8601). Pass null to clear the expiration.'),
});
```

### Step 3.2: Update `UpdateMemoryInput` type

**Location:** `packages/server/src/memory/tools.ts`, lines 144-152

Replace:

```typescript
export interface UpdateMemoryInput {
    store: string;
    path: string;
    content?: string;
    tags?: string[];
    expires_at?: string;
    clear_expiry?: boolean;
}
```

With:

```typescript
export interface UpdateMemoryInput {
    store: string;
    path: string;
    content?: string;
    tags?: string[];
    expires_at?: string | null;
}
```

### Step 3.3: Update `updateMemoryHandler` validation

**Location:** `packages/server/src/memory/tools.ts`, lines 411-417

Replace:

```typescript
if (!input.content && !input.tags && !input.expires_at && !input.clear_expiry) {
    throw new McpError(
        ErrorCode.InvalidParams,
        'No updates provided. Specify content, tags, expires_at, or clear_expiry.'
    );
}
```

With:

```typescript
if (!input.content && !input.tags && input.expires_at === undefined) {
    throw new McpError(
        ErrorCode.InvalidParams,
        'No updates provided. Specify content, tags, or expires_at.'
    );
}
```

Note: `expires_at === null` does NOT equal `undefined`, so passing `null` is correctly detected as an update.

### Step 3.4: Update handler mapping

**Location:** `packages/server/src/memory/tools.ts`, lines 424-429

Replace:

```typescript
const result = await updateMemory(adapterResult.value, memorySerializer, input.path, {
    content: input.content,
    tags: input.tags,
    expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
    clearExpiry: input.clear_expiry,
});
```

With:

```typescript
const result = await updateMemory(adapterResult.value, memorySerializer, input.path, {
    content: input.content,
    tags: input.tags,
    expiresAt:
        input.expires_at === null
            ? null
            : input.expires_at
              ? new Date(input.expires_at)
              : undefined,
});
```

This maps:

- `null` → `null` (clear expiry)
- ISO string → `new Date(...)` (set expiry)
- `undefined` → `undefined` (keep existing)

---

## Task 4: Server — Update tests

**Files:** `packages/server/src/memory/tools.spec.ts`

### Step 4.1: Update clear-expiry test

**Location:** `packages/server/src/memory/tools.spec.ts`, lines 393-421

Find the test `'should clear expiry'` and change the input from `clear_expiry: true` to `expires_at: null`.

### Step 4.2: Verify test passes

Run: `bun test packages/server/src/memory/tools.spec.ts`

---

## Task 5: CLI — Replace `--clear-expiry` with `--no-expires-at`

**Files:** `packages/cli/src/commands/memory/update/command.ts`

### Step 5.1: Update `UpdateCommandOptions` interface

Remove `clearExpiry?: boolean`, update `expiresAt` to `string | false | undefined`.

Commander.js behavior with `--no-X`:

- `--expires-at "2026-12-31"` → `expiresAt: "2026-12-31"` (string)
- `--no-expires-at` → `expiresAt: false`
- Neither provided → `expiresAt: undefined`

```typescript
export interface UpdateCommandOptions {
    content?: string;
    file?: string;
    tags?: string;
    expiresAt?: string | false;
}
```

### Step 5.2: Remove mutual-exclusion check

**Location:** `packages/cli/src/commands/memory/update/command.ts`, lines 70-76

Remove the entire block:

```typescript
if (options.expiresAt && options.clearExpiry) {
    mapCoreError({
        code: 'INVALID_ARGUMENTS',
        message: 'Use either --expires-at or --clear-expiry, not both.',
    });
}
```

Commander.js handles this inherently — the last flag wins.

### Step 5.3: Update expiry resolution logic

**Location:** `packages/cli/src/commands/memory/update/command.ts`, lines 124-131, 135, 170-172

Replace the expiry parsing and merge logic:

- If `options.expiresAt === false` (from `--no-expires-at`): expiry = `null` (clear)
- If `options.expiresAt` is a string: parse as Date, validate
- If `options.expiresAt` is `undefined`: expiry = `undefined` (keep existing)

Replace the `hasExpiryUpdate` check and the merge logic.

### Step 5.4: Update Commander option definition

**Location:** `packages/cli/src/commands/memory/update/command.ts`, line 210

Remove:

```typescript
    .option('-E, --clear-expiry', 'Remove expiration date')
```

The `--no-expires-at` flag is automatic when `--expires-at` is defined with Commander.

### Step 5.5: Update JSDoc examples

**Location:** `packages/cli/src/commands/memory/update/command.ts`, lines 1-26

Replace `--clear-expiry` with `--no-expires-at` in all examples.

---

## Task 6: CLI — Update integration tests

**Files:** `packages/cli/src/tests/cli.integration.spec.ts`

### Step 6.1: Update clear-expiry test

**Location:** `packages/cli/src/tests/cli.integration.spec.ts`, lines 622-645

Change `'should clear expiry date with --clear-expiry'` to `'should clear expiry date with --no-expires-at'` and replace `'--clear-expiry'` with `'--no-expires-at'` in the CLI args.

### Step 6.2: Remove mutual-exclusion test

**Location:** `packages/cli/src/tests/cli.integration.spec.ts`, lines 676-690

Remove or adapt the test `'should fail when both --expires-at and --clear-expiry are used'` — this scenario no longer exists. Commander.js handles the last-wins semantics.

### Step 6.3: Verify tests pass

Run: `bun test packages/cli`

---

## Task 7: Supporting files — Acceptance script + live spec

### Step 7.1: Update acceptance test script

**Location:** `scripts/acceptance-test.ps1`, lines 370-375

Replace `"--clear-expiry"` with `"--no-expires-at"`.

### Step 7.2: Update live OpenSpec spec

**Location:** `openspec/specs/mcp-memory-tools/spec.md`, lines 64-67

Replace:

```markdown
#### Scenario: Clearing expiry

- **WHEN** an agent calls `update_memory` with `clear_expiry: true`
- **THEN** the expiry date is removed from the memory
```

With:

```markdown
#### Scenario: Clearing expiry

- **WHEN** an agent calls `update_memory` with `expires_at: null`
- **THEN** the expiry date is removed from the memory
```

---

## Validation

After all tasks complete:

1. `bun test packages` — all tests pass
2. `bunx tsc --build` — no type errors
3. `openspec validate remove-clear-expiry-flag --strict --no-interactive` — proposal valid
