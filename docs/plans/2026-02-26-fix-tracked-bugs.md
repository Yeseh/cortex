# Fix Tracked Bugs Implementation Plan

**Goal:** Resolve two tracked bugs: MCP server crash on fresh store and CLI failing on fresh home directory.  
**Architecture:** Two targeted bug fixes — one in `packages/core/src/store/store-client.ts` and one in `packages/cli/src/create-cli-command.ts`. No new abstractions needed.  
**Tech Stack:** TypeScript 5.x, Bun runtime, Bun test  
**Session Id:** undefined

---

## Context

Both bugs were tracked in memory (`todo/` category) and are manifesting as 31 failing integration tests on `main`.

### Bug 1: MCP Server crash — `store?.value.categoryMode` is null

**Root cause:** `FilesystemStoreStorage.load()` returns `ok(null)` when the `store.yaml` file doesn't exist (fresh/new store directory). In `StoreClient.load()` (`packages/core/src/store/store-client.ts`), the null is passed through:

```typescript
// storeData.ok() is true, but storeData.value is null!
this.data = storeData.value;
return ok(storeData.value as StoreData); // null cast to StoreData
```

Then in `packages/server/src/index.ts:196`:

```typescript
mode: store?.value.categoryMode ?? 'free',  // TypeError: null is not an object
```

**File to fix:** `packages/core/src/store/store-client.ts` — `load()` method  
**Fix:** When `storeData.value` is null (store.yaml doesn't exist), return a `STORE_NOT_FOUND` error instead of propagating null.

---

### Bug 2: CLI exits with code 1 on fresh home

**Root cause:** `createCliCommandContext()` in `packages/cli/src/create-cli-command.ts` returns `err({ code: 'CONFIG_NOT_FOUND' })` when no config file exists. The `store list` command then calls `throwCliError(context.error)`, causing exit code 1.  
The server's `createCortexContext` handles this by calling `configAdapter.initializeConfig()` which creates a default config. The CLI doesn't.

**File to fix:** `packages/cli/src/create-cli-command.ts` — `createCliCommandContext()` function  
**Fix:** When config file doesn't exist, use `FilesystemConfigAdapter.initializeConfig()` to create a default config (same pattern as server). This requires importing `FilesystemConfigAdapter` from `@yeseh/cortex-storage-fs`.

---

## Task Breakdown

### Task 1 (implementation): Fix `StoreClient.load()` null propagation [packages/core]

**File:** `packages/core/src/store/store-client.ts`

**Change:** After `const storeData = await this.adapter.stores.load(parse.value)`, add a null check before passing the value through:

```typescript
const storeData = await this.adapter.stores.load(parse.value);
if (!storeData.ok()) {
    return err({
        code: 'STORE_NOT_FOUND',
        message: `Store '${this.name}' not found in registry.`,
        store: this.name.toString(),
        cause: storeData.error,
    });
}

// Handle null result (store directory exists in registry but has no store.yaml)
if (storeData.value === null) {
    return err({
        code: 'STORE_NOT_FOUND',
        message: `Store '${this.name}' has no configuration file. Run 'cortex store init ${this.name}' to initialize it.`,
        store: this.name.toString(),
    });
}

this.data = storeData.value;
return ok(storeData.value);
```

**Tests to check:** `packages/core/src/store/` — existing tests for `StoreClient`. Add test case for null store.yaml scenario using a mock adapter that returns `ok(null)`.

---

### Task 2 (implementation): Fix CLI auto-init on fresh home [packages/cli]

**File:** `packages/cli/src/create-cli-command.ts`

**Change:** Replace the manual config file read with `FilesystemConfigAdapter` which handles initialization. Replace current implementation with pattern matching `createCortexContext` in server:

```typescript
import { FilesystemConfigAdapter } from '@yeseh/cortex-storage-fs';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

export const createCliCommandContext = async (
    configDir?: string
): Promise<Result<CortexContext, any>> => {
    try {
        const envConfigDir = process.env.CORTEX_CONFIG_DIR;
        const dir = configDir ?? envConfigDir ?? resolve(homedir(), '.config', 'cortex');
        const absoluteDir = makeAbsolute(dir);
        const configFilePath = resolve(absoluteDir, 'config.yaml');

        // Ensure the config directory exists
        await mkdir(absoluteDir, { recursive: true });

        // Use FilesystemConfigAdapter which handles auto-initialization
        const configAdapter = new FilesystemConfigAdapter(configFilePath);
        const initResult = await configAdapter.initializeConfig();
        if (!initResult.ok()) {
            return err({
                code: 'CONFIG_INIT_FAILED',
                message: `Failed to initialize configuration at ${configFilePath}: ${initResult.error.message}`,
            });
        }

        const effectiveCwd = (() => {
            const configFileCwd = process.env.CORTEX_CONFIG_CWD;
            return typeof configFileCwd === 'string' && configFileCwd.length > 0
                ? configFileCwd
                : process.cwd();
        })();

        const adapterFactory = (storeName: string) => {
            const storeEntry = configAdapter.stores?.[storeName];
            if (!storeEntry) {
                throw new Error(
                    `Store '${storeName}' is not configured. Available stores: ${Object.keys(configAdapter.stores ?? {}).join(', ')}`
                );
            }
            const storePath = storeEntry.properties?.path as string | undefined;
            if (!storePath) {
                throw new Error(`Store '${storeName}' has no path configured in properties.`);
            }
            const absoluteStorePath = makeAbsolute(resolvePath(effectiveCwd, storePath));
            return new FilesystemStorageAdapter({
                rootDirectory: absoluteStorePath,
            });
        };

        const now = () => new Date();
        const cortex = Cortex.init({
            settings: configAdapter.settings!,
            stores: configAdapter.stores!,
            adapterFactory,
        });

        const context: CortexContext = {
            settings: configAdapter.settings ?? getDefaultSettings(),
            stores: configAdapter.stores ?? {},
            cortex,
            now,
            stdin,
            stdout,
        };

        return ok(context);
    } catch (error) {
        throw new Error(
            `Unexpected error creating CLI command context: ${error instanceof Error ? error.message : String(error)}`
        );
    }
};
```

**Note:** Remove the `parseConfig` import since `FilesystemConfigAdapter` handles parsing internally. Keep `getDefaultSettings`, `Cortex`, `err`, `ok`, `CortexContext`, `Result` imports.

**Tests to check:** `packages/cli/tests/cli-basic.integration.spec.ts` — the `should list no stores in a fresh isolated home` test should pass after this fix. All CLI integration tests in `packages/cli/tests/` should pass.

---

### Task 3 (testing): Verify all tests pass

After implementing both fixes:

1. Run `bun test packages`
2. Expected: 0 failures (was 31)
3. If any failures remain, investigate and fix

---

## Dependency Map

```
Task 1 (store-client fix) → independent, can be done first
Task 2 (CLI auto-init fix) → independent, can be done in parallel
Task 3 (verify tests) → depends on Task 1 + Task 2
```

Tasks 1 and 2 can be delegated in parallel to `code-implementer` agents.

---

## Key Files Reference

| File                                                   | Purpose                                         | Task    |
| ------------------------------------------------------ | ----------------------------------------------- | ------- |
| `packages/core/src/store/store-client.ts:102-130`      | StoreClient.load() method                       | Task 1  |
| `packages/storage-fs/src/store-storage.ts:160`         | returns ok(null) when no store.yaml             | Context |
| `packages/cli/src/create-cli-command.ts:50-115`        | createCliCommandContext()                       | Task 2  |
| `packages/storage-fs/src/config-adapter.ts:144`        | FilesystemConfigAdapter.initializeConfig()      | Task 2  |
| `packages/server/src/context.ts:35-75`                 | Reference implementation (server does it right) | Task 2  |
| `packages/server/src/index.ts:188-197`                 | Where bug 1 manifests                           | Context |
| `packages/cli/tests/cli-basic.integration.spec.ts`     | Integration tests that should pass              | Task 3  |
| `packages/server/tests/mcp-health.integration.spec.ts` | Integration tests that should pass              | Task 3  |
