# Path Normalization Output Fix Implementation Plan

**Goal:** Ensure CLI commands display normalized paths (without double slashes) in their output messages
**Architecture:** Core operations already normalize paths via MemoryPath.fromString(). Change createMemory to return the Memory object so CLI can access the normalized path for output.
**Tech Stack:** TypeScript, Bun test
**Session Id:** ses_39f27c366ffew67iOffofX65Wo

---

## Background

The `MemoryPath.fromString()` already normalizes paths by filtering empty segments (e.g., `test//double-slash` becomes `test/double-slash`). However, CLI commands output the original user input instead of the normalized path, causing user confusion.

**Current behavior:**

```bash
$ cortex memory add "test//double-slash" -c "content"
Added memory test//double-slash (flag).  # ← Shows original input
```

**Expected behavior:**

```bash
$ cortex memory add "test//double-slash" -c "content"
Added memory test/double-slash (flag).   # ← Shows normalized path
```

## Tasks

### Phase 1: Core Changes

#### 1.1 Update createMemory return type

**File:** `packages/core/src/memory/operations/create.ts`

Change return type from `MemoryResult<void>` to `MemoryResult<Memory>`:

```typescript
// Before
export const createMemory = async (
    storage: ScopedStorageAdapter,
    path: string,
    input: CreateMemoryInput,
    now?: Date
): Promise<MemoryResult<void>> => {
    // ...
    return ok(undefined);
};

// After
export const createMemory = async (
    storage: ScopedStorageAdapter,
    path: string,
    input: CreateMemoryInput,
    now?: Date
): Promise<MemoryResult<Memory>> => {
    // ...
    return ok(memory);
};
```

- [ ] Update return type in function signature
- [ ] Import `Memory` type (already imported)
- [ ] Return `ok(memory)` instead of `ok(undefined)`
- [ ] Update JSDoc @returns

#### 1.2 Update createMemory tests

**File:** `packages/core/src/memory/operations/create.spec.ts`

- [ ] Update existing tests to expect `Memory` object in result
- [ ] Add test case: verify returned memory has normalized path

#### 1.3 Run core tests

- [ ] Run `bun test packages/core` and ensure all pass

### Phase 2: CLI Changes

#### 2.1 Update memory add command

**File:** `packages/cli/src/commands/memory/add.ts`

Change line 172 to use the returned memory's path:

```typescript
// Before
out.write(`Added memory ${path} (${contentInput.source}).\n`);

// After
const memory = createResult.value;
out.write(`Added memory ${memory.path.toString()} (${contentInput.source}).\n`);
```

- [ ] Update handleAdd to use returned Memory object
- [ ] Update output message to use normalized path

#### 2.2 Update memory update command (if applicable)

**File:** `packages/cli/src/commands/memory/update.ts`

Check if update command has same issue and fix if needed.

- [ ] Review updateMemory return type
- [ ] Update output message if needed

#### 2.3 Update memory move command (if applicable)

**File:** `packages/cli/src/commands/memory/move.ts`

Check if move command has same issue and fix if needed.

- [ ] Review moveMemory return type
- [ ] Update output message if needed

#### 2.4 Run CLI tests

- [ ] Run `bun test packages/cli` and ensure all pass

### Phase 3: MCP Server Changes (if needed)

#### 3.1 Check MCP handlers

**Files:** `packages/server/src/memory/tools/*.ts`

Check if MCP tools return normalized paths. They likely already do since they use core operations.

- [ ] Review MCP memory tool handlers
- [ ] Update if needed to use normalized paths in responses

#### 3.2 Run server tests

- [ ] Run `bun test packages/server` and ensure all pass

### Phase 4: Integration Testing

#### 4.1 Manual verification

- [ ] Test: `cortex memory add "test//double" -c "content"` → should output `test/double`
- [ ] Test: `cortex memory add "/test/leading" -c "content"` → should output `test/leading`
- [ ] Test: `cortex memory update "test//path" --tags new` → should output normalized path
- [ ] Clean up test data

#### 4.2 Add integration test

**File:** `packages/cli/src/tests/cli.integration.spec.ts`

- [ ] Add test case for double-slash path normalization in output

### Phase 5: Documentation & Cleanup

#### 5.1 Update todo memory

- [ ] Move `todo/add-path-normalization-double-slashes` to `history/completed/`

#### 5.2 Commit changes

- [ ] Commit with message: `fix(cli): display normalized paths in command output`

## Files to Modify

1. `packages/core/src/memory/operations/create.ts` - Return Memory instead of void
2. `packages/core/src/memory/operations/create.spec.ts` - Update tests
3. `packages/cli/src/commands/memory/add.ts` - Use normalized path in output
4. `packages/cli/src/commands/memory/update.ts` - Check and update if needed
5. `packages/cli/src/commands/memory/move.ts` - Check and update if needed
6. `packages/cli/src/tests/cli.integration.spec.ts` - Add test case

## Verification

```bash
# Run all tests
bun test packages

# Manual test
bun run ./packages/cli/src/run.ts memory add "test//normalize" -c "test" --store default
# Expected output: "Added memory test/normalize (flag)."
```
