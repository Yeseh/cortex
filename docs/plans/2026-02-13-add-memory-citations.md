# Add Memory Citations Implementation Plan

**Goal:** Add a `citations: string[]` field to memories for referencing source material (files, URLs).
**Architecture:** Extend MemoryMetadata with optional citations array, flowing through core → storage-fs → server → cli
**Tech Stack:** TypeScript, Bun, Zod, Commander.js
**Session Id:** ses_3a797194affexndQJxF0Kh4Yey

---

## Dependency Graph

```
Task 1 (Core Types) ← Task 2 (Core Operations) ← Task 3 (Storage-FS)
                                                       ↓
                                              Task 4 (MCP) + Task 5 (CLI)
                                                       ↓
                                              Task 6 (Verification)
```

Tasks 4 and 5 can run in parallel after Task 3 is complete.

---

## Task 1: Core - Add `citations` to `MemoryMetadata` (Implementation)

**Files:** `packages/core/src/memory/types.ts`

### 1.1 Add `citations` field to `MemoryMetadata`

Add `citations: string[]` after `expiresAt`:

```typescript
export type MemoryMetadata = {
    /** When the memory was created */
    createdAt: Date;
    /** When the memory was last updated */
    updatedAt: Date;
    /** Tags for categorization and discovery */
    tags: string[];
    /** Source of the memory (e.g., "user", "system", "mcp") */
    source: string;
    /** Optional expiration timestamp for automatic cleanup */
    expiresAt?: Date;
    /** References to source material (file paths, URLs) */
    citations: string[];
};
```

### 1.2 Add `INVALID_CITATIONS` error code

Add to `MemoryErrorCode` union after `INVALID_SOURCE`:

```typescript
export type MemoryErrorCode =
    // Parsing/validation errors
    | 'MISSING_FRONTMATTER'
    | 'INVALID_FRONTMATTER'
    | 'MISSING_FIELD'
    | 'INVALID_TIMESTAMP'
    | 'INVALID_TAGS'
    | 'INVALID_SOURCE'
    | 'INVALID_CITATIONS';
// ... rest
```

Update JSDoc for error codes to include `INVALID_CITATIONS`.

---

## Task 2: Core - Add `citations` to Input Types (Implementation)

**Files:** `packages/core/src/memory/operations.ts`

### 2.1 Add `citations` to `CreateMemoryInput`

```typescript
export interface CreateMemoryInput {
    content: string;
    tags?: string[];
    source: string;
    expiresAt?: Date;
    /** References to source material (file paths, URLs) */
    citations?: string[];
}
```

### 2.2 Add `citations` to `UpdateMemoryInput`

```typescript
export interface UpdateMemoryInput {
    content?: string;
    tags?: string[];
    expiresAt?: Date | null;
    /** References to source material (replaces existing when provided) */
    citations?: string[];
}
```

### 2.3 Update `createMemory` function

Pass citations through to the Memory object (default to `[]`):

```typescript
// In createMemory, line ~389
const memory: Memory = {
    metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        tags: input.tags ?? [],
        source: input.source,
        expiresAt: input.expiresAt,
        citations: input.citations ?? [],
    },
    content: input.content,
};
```

### 2.4 Update `updateMemory` function

Handle citations with overwrite semantics (omission preserves):

```typescript
// In updateMemory, line ~529
const hasUpdates =
    updates.content !== undefined ||
    updates.tags !== undefined ||
    updates.expiresAt !== undefined ||
    updates.citations !== undefined;

// Line ~568
const updatedMemory: Memory = {
    metadata: {
        createdAt: existing.metadata.createdAt,
        updatedAt: timestamp,
        tags: updates.tags ?? existing.metadata.tags,
        source: existing.metadata.source,
        expiresAt:
            updates.expiresAt === null
                ? undefined
                : (updates.expiresAt ?? existing.metadata.expiresAt),
        citations: updates.citations ?? existing.metadata.citations,
    },
    content: updates.content ?? existing.content,
};
```

---

## Task 3: Storage-FS - Frontmatter Serialization (Implementation)

**Files:** `packages/storage-fs/src/memories.ts`

### 3.1 Add citation validation schema

Add after line 21 (where schemas are imported/defined):

```typescript
/** Schema for validating citation strings (non-empty strings) */
const citationSchema = z.string().min(1, 'Citation must not be empty');
const citationsSchema = z.array(citationSchema).optional().default([]);
```

### 3.2 Update `FrontmatterSchema`

Add `citations` field (snake_case):

```typescript
const FrontmatterSchema = z.object({
    created_at: dateSchema,
    updated_at: dateSchema,
    tags: tagsSchema,
    source: nonEmptyStringSchema,
    expires_at: dateSchema.optional(),
    citations: citationsSchema,
});
```

### 3.3 Update `mapZodErrorCode` function

Handle citations field:

```typescript
const mapZodErrorCode = (field: string | undefined, fieldExists: boolean): MemoryErrorCode => {
    // ... existing logic
    if (field === 'citations') {
        return 'INVALID_CITATIONS';
    }
    // ...
};
```

### 3.4 Update `mapSerializeErrorCode` function

Handle citations field:

```typescript
const mapSerializeErrorCode = (field: string | undefined): MemoryErrorCode => {
    if (field === 'tags') return 'INVALID_TAGS';
    if (field === 'source') return 'INVALID_SOURCE';
    if (field === 'citations') return 'INVALID_CITATIONS';
    return 'INVALID_TIMESTAMP';
};
```

### 3.5 Update `parseMetadata` function

Return citations in camelCase (line ~173):

```typescript
return ok({
    createdAt: result.data.created_at,
    updatedAt: result.data.updated_at,
    tags: result.data.tags,
    source: result.data.source,
    expiresAt: result.data.expires_at,
    citations: result.data.citations ?? [],
});
```

### 3.6 Update `serializeMemory` function

Add citations to snake_case metadata and conditionally include in output:

```typescript
// Line ~229, convert camelCase to snake_case
const snakeCaseMetadata = {
    created_at: memory.metadata.createdAt,
    updated_at: memory.metadata.updatedAt,
    tags: memory.metadata.tags,
    source: memory.metadata.source,
    expires_at: memory.metadata.expiresAt,
    citations: memory.metadata.citations,
};

// Line ~251, output frontmatter (omit empty citations)
const frontmatterData = {
    created_at: created_at.toISOString(),
    updated_at: updated_at.toISOString(),
    tags,
    source,
    ...(expires_at ? { expires_at: expires_at.toISOString() } : {}),
    ...(result.data.citations && result.data.citations.length > 0
        ? { citations: result.data.citations }
        : {}),
};
```

---

## Task 4: MCP - Add Citations Support (Implementation)

**Files:** `packages/server/src/memory/tools.ts`

### 4.1 Update `addMemoryInputSchema`

Add citations field:

```typescript
export const addMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    content: z.string().min(1, 'Content is required').describe('Memory content'),
    tags: tagsSchema.describe('Optional tags for categorization'),
    expires_at: isoDateSchema.optional().describe('Optional expiration date (ISO 8601)'),
    citations: z
        .array(z.string().min(1))
        .optional()
        .describe('Optional citations referencing source material'),
});
```

### 4.2 Update `AddMemoryInput` interface

```typescript
export interface AddMemoryInput {
    store: string;
    path: string;
    content: string;
    tags?: string[];
    expires_at?: string;
    citations?: string[];
}
```

### 4.3 Update `updateMemoryInputSchema`

Add citations field:

```typescript
export const updateMemoryInputSchema = z.object({
    store: storeNameSchema.describe('Store name (required)'),
    path: memoryPathSchema.describe('Memory path in category/slug format'),
    content: z.string().optional().describe('New memory content'),
    tags: tagsSchema.describe('New tags (replaces existing)'),
    expires_at: isoDateSchema
        .optional()
        .nullable()
        .describe(
            'New expiration date (ISO 8601). Pass null to clear the expiration. Omit to keep existing value.'
        ),
    citations: z.array(z.string().min(1)).optional().describe('New citations (replaces existing)'),
});
```

### 4.4 Update `UpdateMemoryInput` interface

```typescript
export interface UpdateMemoryInput {
    store: string;
    path: string;
    content?: string;
    tags?: string[];
    expires_at?: string | null;
    citations?: string[];
}
```

### 4.5 Update `addMemoryHandler`

Pass citations to createMemory:

```typescript
const result = await createMemory(adapterResult.value, memorySerializer, input.path, {
    content: input.content,
    tags: input.tags,
    source: 'mcp',
    expiresAt: input.expires_at ? new Date(input.expires_at) : undefined,
    citations: input.citations,
});
```

### 4.6 Update `getMemoryHandler`

Include citations in response:

```typescript
const output = {
    path: input.path,
    content: memory.content,
    metadata: {
        created_at: memory.metadata.createdAt.toISOString(),
        updated_at: memory.metadata.updatedAt?.toISOString(),
        tags: memory.metadata.tags,
        source: memory.metadata.source,
        expires_at: memory.metadata.expiresAt?.toISOString(),
        citations: memory.metadata.citations,
    },
};
```

### 4.7 Update `updateMemoryHandler`

Add citations check and pass to updateMemory:

```typescript
// Validate that at least one update field is provided
if (
    input.content === undefined &&
    input.tags === undefined &&
    input.expires_at === undefined &&
    input.citations === undefined
) {
    throw new McpError(
        ErrorCode.InvalidParams,
        'No updates provided. Specify content, tags, expires_at, or citations.'
    );
}

const result = await updateMemory(adapterResult.value, memorySerializer, input.path, {
    content: input.content,
    tags: input.tags,
    expiresAt:
        input.expires_at === null
            ? null
            : input.expires_at
              ? new Date(input.expires_at)
              : undefined,
    citations: input.citations,
});
```

### 4.8 Update `translateMemoryError`

Handle INVALID_CITATIONS error code:

```typescript
case 'INVALID_CITATIONS':
    return new McpError(
        ErrorCode.InternalError,
        `Memory file corrupted: ${error.message}`,
    );
```

---

## Task 5: CLI - Add `--citation` Flag (Implementation)

**Files:**

- `packages/cli/src/commands/memory/add/command.ts`
- `packages/cli/src/commands/memory/update/command.ts`

### 5.1 Update add command options interface

```typescript
export interface AddCommandOptions {
    content?: string;
    file?: string;
    tags?: string;
    expiresAt?: string;
    citation?: string[];
}
```

### 5.2 Add `--citation` option to add command

```typescript
export const addCommand = new Command('add')
    .description('Create a new memory')
    .argument('<path>', 'Memory path (e.g., project/tech-stack)')
    .option('-c, --content <text>', 'Memory content as inline text')
    .option('-f, --file <filepath>', 'Read content from a file')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('-e, --expires-at <date>', 'Expiration date (ISO 8601)')
    .option(
        '--citation <value>',
        'Citation reference (repeatable)',
        (val, prev: string[]) => [...prev, val],
        []
    );
// ...
```

### 5.3 Update add command handler

Build memory with citations:

```typescript
// Parse citations from options
const citations = options.citation ?? [];

// Build memory with citations
const memory: Memory = {
    metadata: {
        createdAt: now,
        updatedAt: now,
        tags,
        source: contentResult.value.source,
        expiresAt,
        citations,
    },
    content: contentResult.value.content ?? '',
};
```

### 5.4 Update update command options interface

```typescript
export interface UpdateCommandOptions {
    content?: string;
    file?: string;
    tags?: string;
    expiresAt?: string | false;
    citation?: string[];
}
```

### 5.5 Add `--citation` option to update command

```typescript
export const updateCommand = new Command('update')
    .description('Update an existing memory')
    .argument('<path>', 'Memory path to update')
    .option('-c, --content <text>', 'New memory content as inline text')
    .option('-f, --file <filepath>', 'Read new content from a file')
    .option('-t, --tags <tags>', 'Comma-separated tags (replaces existing)')
    .option('-e, --expires-at <date>', 'New expiration date (ISO 8601)')
    .option('--no-expires-at', 'Remove expiration date')
    .option(
        '--citation <value>',
        'Citation reference (replaces existing, repeatable)',
        (val, prev: string[]) => [...prev, val],
        []
    );
// ...
```

### 5.6 Update update command handler

Handle citations in update:

```typescript
// Parse citations from options (undefined if not provided, array if provided)
const citations =
    options.citation !== undefined && options.citation.length > 0 ? options.citation : undefined;

// Verify at least one update is provided
const hasCitationsUpdate = citations !== undefined;

if (!hasContentUpdate && !hasTagsUpdate && !hasExpiryUpdate && !hasCitationsUpdate) {
    mapCoreError({
        code: 'INVALID_ARGUMENTS',
        message: 'No updates provided. Use --content, --file, --tags, --citation, or expiry flags.',
    });
}

// Build updated memory
const updatedMemory: Memory = {
    metadata: {
        ...parsedMemory.value.metadata,
        updatedAt: now,
        tags: tags ?? parsedMemory.value.metadata.tags,
        expiresAt:
            expiresAt === null ? undefined : (expiresAt ?? parsedMemory.value.metadata.expiresAt),
        citations: citations ?? parsedMemory.value.metadata.citations,
    },
    content: contentResult.value.content ?? parsedMemory.value.content,
};
```

---

## Task 6: Testing (Testing)

### 6.1 Core tests (`packages/core/src/memory/operations.spec.ts`)

Test cases:

- Create memory with citations
- Create memory without citations (defaults to [])
- Update memory with new citations (replaces existing)
- Update memory with empty citations array (clears)
- Update memory without citations parameter (preserves existing)

### 6.2 Storage-FS tests (`packages/storage-fs/src/memories.spec.ts`)

Test cases:

- Parse memory with citations in frontmatter
- Parse memory without citations field (defaults to [])
- Serialize memory with citations
- Serialize memory with empty citations (omits key)
- Round-trip with citations
- Reject empty citation strings

### 6.3 MCP tests (`packages/server/src/memory/tools.spec.ts`)

Test cases:

- addMemoryHandler with citations
- getMemoryHandler returns citations
- updateMemoryHandler with citations

### 6.4 CLI tests (integration tests if applicable)

Test cases:

- `cortex add` with `--citation` flag
- `cortex update` with `--citation` flag

---

## Task 7: Verification

### 7.1 Run tests

```bash
bun test packages
```

### 7.2 Type check

```bash
bunx tsc --build
```

### 7.3 Lint

```bash
bunx eslint packages/*/src/**/*.ts --fix
```

---

## Parallelization Strategy

1. **Sequential**: Task 1 → Task 2 → Task 3 (dependencies)
2. **Parallel**: Task 4 and Task 5 (can run in parallel after Task 3)
3. **Sequential**: Task 6 (after all implementation tasks)
