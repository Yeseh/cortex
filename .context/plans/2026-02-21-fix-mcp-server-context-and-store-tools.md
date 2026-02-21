# Fix MCP Server Context and Store Tools Implementation Plan

**Goal:** Fix critical bugs in MCP server where it calls non-existent Cortex methods and uses removed FilesystemRegistry imports.

**Architecture:** Align MCP server's ToolContext with CLI's CortexContext pattern by including ConfigStores. Remove calls to non-existent Cortex.fromConfig() and cortex.getRegistry(). Update store tools to use context stores instead of FilesystemRegistry.

**Tech Stack:** TypeScript, Bun, @yeseh/cortex-core, @yeseh/cortex-storage-fs, MCP SDK

**Session Id:** undefined

---

## Problem Summary

The MCP server has critical bugs introduced during refactors:

1. **Non-existent method calls** in `packages/server/src/index.ts`:
    - Line 172: Calls `Cortex.fromConfig()` which doesn't exist
    - Line 193: Calls `cortex.getRegistry()` which doesn't exist

2. **Removed import** in `packages/server/src/store/tools.ts`:
    - Line 22: Imports `FilesystemRegistry` from `@yeseh/cortex-storage-fs` which was deleted

3. **Incomplete ToolContext**:
    - CLI uses `CortexContext` with `{ cortex, settings, stores, now, stdin, stdout, cwd? }`
    - MCP uses `ToolContext` with only `{ config, cortex }`
    - Missing `stores: ConfigStores` field breaks store operations

## Root Cause

The server code was written expecting an API that was planned but never implemented. The `Cortex` class only has `init()` and `getStore()`, but server code expects `fromConfig()` and `getRegistry()`.

## Success Criteria

- ✅ Server starts without TypeScript errors
- ✅ Store tools tests pass
- ✅ All MCP server tests pass
- ✅ Can list stores via MCP tool
- ✅ Can create stores via MCP tool
- ✅ No references to `FilesystemRegistry` in server code

---

## Implementation Tasks

### Phase 1: Update ToolContext to Include Stores

#### Task 1.1: Read current ToolContext definition

**File:** `packages/server/src/memory/tools/shared.ts`
**Action:** Read lines 30-35 to understand current ToolContext interface

**Why:** Need to see what fields exist before extending it

#### Task 1.2: Import ConfigStores type in shared.ts

**File:** `packages/server/src/memory/tools/shared.ts`
**Action:** Add to imports:

```typescript
import type { Cortex, MemoryError, ConfigStores, CortexSettings } from '@yeseh/cortex-core';
```

**Why:** Need ConfigStores and CortexSettings types for extended context

**Test:** TypeScript compilation succeeds

#### Task 1.3: Extend ToolContext interface

**File:** `packages/server/src/memory/tools/shared.ts`
**Action:** Replace ToolContext interface with:

```typescript
export interface ToolContext {
    config: ServerConfig;
    cortex: Cortex;
    stores: ConfigStores;
    settings: CortexSettings;
}
```

**Why:** Aligns with CortexContext structure used by CLI

**Test:** TypeScript compilation shows errors where ToolContext is created (expected)

#### Task 1.4: Commit Phase 1

**Action:**

```bash
git add packages/server/src/memory/tools/shared.ts
git commit -m "refactor(server): extend ToolContext with stores and settings fields"
```

---

### Phase 2: Fix Server Initialization to Create Full Context

#### Task 2.1: Read server config loading code

**File:** `packages/server/src/index.ts`
**Action:** Read lines 147-200 to understand current initialization

**Why:** Need to see how config is loaded and cortex is created

#### Task 2.2: Create helper function for loading config

**File:** `packages/server/src/index.ts`
**Action:** Add after imports, before createServer():

```typescript
import {
    parseConfig,
    getDefaultSettings,
    type ConfigStores,
    type CortexSettings,
} from '@yeseh/cortex-core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Loads Cortex configuration from config.yaml in the data path.
 *
 * @param dataPath - Directory containing config.yaml
 * @returns Result with parsed config or fallback to defaults
 */
const loadCortexConfig = async (
    dataPath: string
): Promise<{ stores: ConfigStores; settings: CortexSettings }> => {
    const configPath = join(dataPath, 'config.yaml');

    try {
        const contents = await readFile(configPath, 'utf-8');
        const parseResult = parseConfig(contents);

        if (parseResult.ok()) {
            return {
                stores: parseResult.value.stores ?? {},
                settings: parseResult.value.settings ?? getDefaultSettings(),
            };
        }
    } catch (error) {
        // Config file doesn't exist or can't be read - use defaults
        console.warn(`No config found at ${configPath}, using defaults`);
    }

    // Fallback to defaults
    return {
        stores: {},
        settings: getDefaultSettings(),
    };
};
```

**Why:** Encapsulates config loading logic and provides fallback

**Test:** TypeScript compilation succeeds

#### Task 2.3: Remove calls to non-existent Cortex methods

**File:** `packages/server/src/index.ts`
**Action:** Replace lines 171-183 with:

```typescript
// Load Cortex config
const { stores, settings } = await loadCortexConfig(config.dataPath);

// Create Cortex instance
const cortex = Cortex.init({
    stores,
    settings,
    adapterFactory: createAdapterFactory(),
});
```

**Why:** Cortex.fromConfig() doesn't exist; use parseConfig + Cortex.init()

**Test:** TypeScript compilation succeeds (no more fromConfig error)

#### Task 2.4: Update ToolContext creation

**File:** `packages/server/src/index.ts`
**Action:** Replace line 186 with:

```typescript
// Create tool context with full configuration
const toolContext: ToolContext = { config, cortex, stores, settings };
```

**Why:** ToolContext now requires stores and settings fields

**Test:** TypeScript compilation succeeds

#### Task 2.5: Replace cortex.getRegistry() call

**File:** `packages/server/src/index.ts`
**Action:** Replace lines 192-198 with:

```typescript
// Get category mode options from default store config
const defaultStoreConfig = stores[config.defaultStore];
const categoryToolsOptions: CategoryToolsOptions = {
    mode: defaultStoreConfig?.categoryMode ?? 'free',
    configCategories: defaultStoreConfig?.categories,
};
```

**Why:** cortex.getRegistry() doesn't exist; use stores from context

**Test:** TypeScript compilation succeeds with no errors in index.ts

#### Task 2.6: Commit Phase 2

**Action:**

```bash
git add packages/server/src/index.ts
git commit -m "fix(server): replace non-existent Cortex methods with proper config loading"
```

---

### Phase 3: Fix Store Tools to Use Context Stores

#### Task 3.1: Remove FilesystemRegistry imports

**File:** `packages/server/src/store/tools.ts`
**Action:** Replace lines 16-24 with:

```typescript
import * as fs from 'node:fs/promises';
import { z } from 'zod';
import { err, ok, type Result } from '@yeseh/cortex-core';
import type { CategoryMode } from '@yeseh/cortex-core';
import type { ToolContext } from '../memory/tools/shared.ts';
import { convertToCategories, type CategoryInfo } from './shared.ts';
```

**Why:** Remove unused imports (path, initializeStore, FilesystemRegistry)

**Test:** TypeScript shows errors where FilesystemRegistry is used (expected)

#### Task 3.2: Remove unused listStoresFromRegistry function

**File:** `packages/server/src/store/tools.ts`
**Action:** Delete the entire `listStoresFromRegistry` function (lines ~137-176)

**Why:** This function uses removed FilesystemRegistry and is no longer needed

**Note:** The function isn't called anywhere; listStoresHandler uses ctx directly

**Test:** TypeScript compilation succeeds

#### Task 3.3: Update listStoresHandler to use ctx.stores

**File:** `packages/server/src/store/tools.ts`
**Action:** Replace listStoresHandler implementation (~lines 209-224) with:

```typescript
export const listStoresHandler = async (ctx: ToolContext): Promise<StoreToolResponse> => {
    const stores: StoreInfo[] = Object.entries(ctx.stores)
        .map(([name, definition]) => ({
            name,
            path: (definition.properties as { path: string }).path,
            ...(definition.description !== undefined && { description: definition.description }),
            categoryMode: definition.categoryMode ?? 'free',
            categories: convertToCategories(definition.categories),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return {
        content: [{ type: 'text', text: JSON.stringify({ stores }, null, 2) }],
    };
};
```

**Why:** Access stores from context instead of calling cortex.getRegistry()

**Test:** TypeScript compilation succeeds

#### Task 3.4: Read current createStoreHandler implementation

**File:** `packages/server/src/store/tools.ts`
**Action:** Read lines ~226-289 to understand what needs fixing

**Why:** Need to see what FilesystemRegistry and initializeStore calls to replace

#### Task 3.5: Determine store creation strategy

**Decision Point:** The MCP server currently delegates to `initializeStore()` from core which doesn't exist. Options:

**Option A (Recommended):** Return error - store creation requires config file updates

```typescript
// Store creation not supported via MCP - requires config file modification
return {
    content: [
        {
            type: 'text',
            text: 'Error: Store creation via MCP is not supported. Add stores to config.yaml instead.',
        },
    ],
    isError: true,
};
```

**Option B:** Implement in-memory store creation (doesn't persist to config)

- Creates store directory
- Doesn't update config.yaml
- Store won't be available after server restart

**Choose Option A** - safer, clearer UX, forces proper config management

**Why:** Store creation should go through config file for persistence

#### Task 3.6: Update createStoreHandler

**File:** `packages/server/src/store/tools.ts`
**Action:** Replace createStoreHandler implementation with:

```typescript
export const createStoreHandler = async (
    ctx: ToolContext,
    input: CreateStoreInput
): Promise<StoreToolResponse> => {
    // Validate input
    const validation = createStoreInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: Store name is invalid: ${validation.error.issues[0]?.message}`,
                },
            ],
            isError: true,
        };
    }

    // Store creation via MCP not supported - requires config file modification
    return {
        content: [
            {
                type: 'text',
                text:
                    `Error: Store creation via MCP is not supported. To create a store, add it to your config.yaml:\n\n` +
                    `stores:\n` +
                    `  ${input.name}:\n` +
                    `    kind: filesystem\n` +
                    `    properties:\n` +
                    `      path: /absolute/path/to/${input.name}\n` +
                    `    categoryMode: free  # or 'subcategories' or 'strict'\n` +
                    `\nThen restart the server.`,
            },
        ],
        isError: true,
    };
};
```

**Why:** Store creation requires config persistence which MCP tools shouldn't handle

**Alternative:** If user wants store creation, we need to implement config file writing (more complex, out of scope)

**Test:** TypeScript compilation succeeds with no errors in tools.ts

#### Task 3.7: Commit Phase 3

**Action:**

```bash
git add packages/server/src/store/tools.ts
git commit -m "fix(server): remove FilesystemRegistry and update store tools to use context"
```

---

### Phase 4: Update Documentation

#### Task 4.1: Fix errors.ts JSDoc example

**File:** `packages/server/src/errors.ts`
**Action:** Find and update JSDoc example that references FilesystemRegistry (around line 196-202):

Replace:

````typescript
 * @example
 * ```ts
 * const registry = new FilesystemRegistry(path);
 * const result = await registry.load();
 * if (!result.ok()) {
 *   throw handleDomainError(result.error);
 * }
 * ```
````

With:

````typescript
 * @example
 * ```ts
 * const configResult = await loadConfig(path);
 * if (!configResult.ok()) {
 *   throw handleDomainError(configResult.error);
 * }
 * ```
````

**Why:** FilesystemRegistry no longer exists

**Test:** No TypeScript errors; documentation is accurate

#### Task 4.2: Commit Phase 4

**Action:**

```bash
git add packages/server/src/errors.ts
git commit -m "docs(server): update JSDoc example to remove FilesystemRegistry reference"
```

---

### Phase 5: Testing

#### Task 5.1: Run TypeScript type checking

**Action:**

```bash
cd packages/server
bunx tsc --noEmit
```

**Expected:** No type errors

**If errors:** Fix them before proceeding

#### Task 5.2: Run store tools tests

**Action:**

```bash
cd packages/server
bun test src/store/tools.spec.ts
```

**Expected:** Tests pass or show clear failures related to createStoreHandler changes

**If failures:**

- If test expects store creation to succeed, update test to expect error
- If test expects different error message, update assertions

#### Task 5.3: Update store tools tests for new behavior

**File:** `packages/server/src/store/tools.spec.ts`
**Action:** Find tests that call createStoreHandler and update expectations:

Before:

```typescript
expect(result.content[0].text).toContain('created');
```

After:

```typescript
expect(result.isError).toBe(true);
expect(result.content[0].text).toContain('not supported');
```

**Why:** createStoreHandler now returns error instead of creating stores

**Test:** `bun test src/store/tools.spec.ts` passes

#### Task 5.4: Run all memory tools tests

**Action:**

```bash
cd packages/server
bun test src/memory/tools/
```

**Expected:** All tests pass

**If failures:** ToolContext creation in tests needs stores and settings fields

**Fix:** Update test utilities in `test-utils.ts` to provide stores and settings:

```typescript
const testContext: ToolContext = {
    config: testConfig,
    cortex: testCortex,
    stores: {},
    settings: getDefaultSettings(),
};
```

#### Task 5.5: Run all server tests

**Action:**

```bash
cd packages/server
bun test
```

**Expected:** All tests pass

**If failures:** Review and fix based on error messages

#### Task 5.6: Manual smoke test - start server

**Action:**

```bash
cd packages/server
bun run src/bin.ts
```

**Expected:** Server starts without errors

**If errors:** Debug and fix server startup issues

#### Task 5.7: Manual smoke test - list stores via MCP

**Action:** Use MCP client or curl to test list_stores tool:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"cortex_list_stores","arguments":{}}}'
```

**Expected:** Returns JSON response with stores list (may be empty)

**If error:** Debug and fix listStoresHandler

#### Task 5.8: Commit Phase 5

**Action:**

```bash
git add packages/server/src/store/tools.spec.ts packages/server/src/memory/tools/test-utils.ts
git commit -m "test(server): update tests for new ToolContext and store handler behavior"
```

---

### Phase 6: Update Related Tests

#### Task 6.1: Find all test files that create ToolContext

**Action:**

```bash
rg "ToolContext" packages/server/src --type ts -l
```

**Expected:** List of test files

**Action:** Review each file and update ToolContext creation to include stores and settings

#### Task 6.2: Update health check tests

**File:** `packages/server/src/health.spec.ts`
**Action:** If it creates ToolContext or similar, add stores and settings fields

**Test:** `bun test src/health.spec.ts` passes

#### Task 6.3: Run full test suite

**Action:**

```bash
cd packages/server
bun test
```

**Expected:** All tests pass

#### Task 6.4: Commit Phase 6

**Action:**

```bash
git add packages/server/src/
git commit -m "test(server): update remaining tests for extended ToolContext"
```

---

## Testing Strategy

### Unit Tests

- `packages/server/src/store/tools.spec.ts` - Store tool handlers
- `packages/server/src/memory/tools/*.spec.ts` - Memory tool handlers
- `packages/server/src/health.spec.ts` - Health check endpoint

### Integration Tests

- Server startup with real config
- MCP tool invocations via HTTP

### Manual Testing

1. Start server: `bun run src/bin.ts`
2. List stores via MCP tool
3. Try to create store (should error gracefully)
4. Health check endpoint: `curl http://localhost:3000/health`

---

## Edge Cases & Considerations

### Missing Config File

**Scenario:** Server starts without config.yaml
**Expected:** Uses default empty stores and default settings
**Implementation:** loadCortexConfig() returns defaults on error

### Invalid Config File

**Scenario:** config.yaml has syntax errors
**Expected:** Server logs warning and uses defaults
**Implementation:** parseConfig() fails, loadCortexConfig() catches and returns defaults

### Empty Stores

**Scenario:** config.yaml exists but has no stores defined
**Expected:** listStoresHandler returns empty array
**Implementation:** ctx.stores is empty object, Object.entries returns []

### Store Creation Attempts

**Scenario:** User tries to create store via MCP
**Expected:** Clear error message explaining config file approach
**Implementation:** createStoreHandler returns helpful error with YAML example

---

## Rollback Plan

If issues arise after merging:

1. **Revert commits:**

    ```bash
    git revert <commit-hash> --no-commit
    git revert <commit-hash> --no-commit
    ...
    git commit -m "revert: rollback MCP server context fixes"
    ```

2. **Alternative:** Checkout previous working commit:

    ```bash
    git checkout <previous-working-commit>
    ```

3. **Quick fix:** If only store tools broken, comment out registerStoreTools() in index.ts temporarily

---

## Future Improvements (Out of Scope)

1. **Store Creation via MCP:** Implement config file writing to support creating stores
    - Read config.yaml
    - Add new store definition
    - Validate
    - Write back to file
    - Reload server context

2. **Store Removal via MCP:** Similar to creation, requires config modification

3. **Dynamic Store Reloading:** Reload stores without server restart when config changes

4. **Validation Middleware:** Validate all MCP tool inputs before handler execution

---

## Dependencies

- `@yeseh/cortex-core` - ConfigStores, CortexSettings, parseConfig types
- `@yeseh/cortex-storage-fs` - FilesystemStorageAdapter (already used)
- `node:fs/promises` - readFile for config loading
- `node:path` - join for path operations

---

## Definition of Done

- [ ] All TypeScript compilation errors resolved
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Server starts successfully
- [ ] Can list stores via MCP tool
- [ ] Store creation returns clear error message
- [ ] No references to FilesystemRegistry in server code
- [ ] Documentation updated (JSDoc examples)
- [ ] Code committed with clear messages
- [ ] Manual testing completed successfully

---

## Notes for Implementer

1. **Don't skip commits:** Each phase should be committed separately for clean history

2. **Test incrementally:** Run TypeScript checks after each file change

3. **Read before editing:** Always read the full context of what you're changing

4. **Follow patterns:** CLI already solves this problem - mirror its approach

5. **Ask questions:** If something is unclear or seems wrong, pause and investigate

6. **Keep it simple:** The fix is straightforward - align MCP with CLI patterns

7. **Watch for test utils:** Test files often have their own ToolContext creation that needs updating
