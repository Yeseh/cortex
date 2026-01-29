# Store Init Project Support Implementation Plan

**Goal:** Enhance `cortex store init` to auto-detect git repo name, support `--name` flag, register stores, and create project entries
**Architecture:** Add git detection utility, enhance store init command with flag parsing and registry integration
**Tech Stack:** TypeScript, Bun test runner, node:child_process for git commands
**Session Id:** ses_3f573667affeWpioT76dc69bHp

---

## Task Dependency Map

```
Task 1: Git Detection Helper ──┐
                                ├─> Task 2: CLI Flag & Validation ──┐
                                │                                     │
                                │                                     ├─> Task 3: Store Registration ──┐
                                │                                     │                                  │
                                │                                     │                                  ├─> Task 4: Project Entry
                                │                                     │                                  │
                                └─────────────────────────────────────┴──────────────────────────────────┘
                                                                      │
Task 5: Unit Tests (parallel to implementation tasks where possible) ─┘
```

## Task 1: Git Repository Detection Helper

### Objective

Create a helper function to detect the git repository root and extract its name.

### File Location

`src/cli/commands/store.ts` (add to existing file)

### Implementation Details

```typescript
import { spawn } from 'node:child_process';
import { basename } from 'node:path';

/**
 * Executes a git command and returns the trimmed stdout.
 */
const runGitCommand = (args: string[], cwd: string): Promise<Result<string, StoreCommandError>> => {
    return new Promise((resolve) => {
        const proc = spawn('git', args, { cwd, shell: true });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });
        proc.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });
        proc.on('close', (code: number | null) => {
            if (code === 0) {
                resolve(ok(stdout.trim()));
            } else {
                resolve(
                    err({
                        code: 'GIT_COMMAND_FAILED',
                        message: stderr.trim() || `Git command failed with code ${code}`,
                    })
                );
            }
        });
        proc.on('error', (error: Error) => {
            resolve(
                err({
                    code: 'GIT_COMMAND_FAILED',
                    message: error.message,
                    cause: error,
                })
            );
        });
    });
};

/**
 * Detects the git repository name from the current working directory.
 * Returns null if not in a git repository.
 */
const detectGitRepoName = async (cwd: string): Promise<string | null> => {
    const result = await runGitCommand(['rev-parse', '--show-toplevel'], cwd);
    if (!result.ok) {
        return null;
    }
    return basename(result.value);
};
```

### Test Cases

- Returns repo name when in git repository
- Returns null when not in git repository
- Handles git command errors gracefully

---

## Task 2: CLI Flag and Validation

### Objective

Add `--name` flag parsing and name resolution logic to `store init`.

### File Location

`src/cli/commands/store.ts`

### Changes Required

1. **Add new error code**:

```typescript
export type StoreCommandErrorCode =
    | 'INVALID_COMMAND'
    | 'INVALID_STORE_NAME'
    | 'INVALID_STORE_PATH'
    | 'STORE_ALREADY_EXISTS'
    | 'STORE_REGISTRY_FAILED'
    | 'STORE_INIT_FAILED'
    | 'GIT_COMMAND_FAILED' // New
    | 'GIT_REPO_REQUIRED'; // New
```

2. **Parse --name flag**:

```typescript
interface StoreInitOptions {
    targetPath?: string;
    name?: string;
}

const parseStoreInitArgs = (args: string[]): StoreInitOptions => {
    const options: StoreInitOptions = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--name' && args[i + 1]) {
            options.name = args[i + 1];
            i++; // Skip next arg
        } else if (!arg?.startsWith('--')) {
            options.targetPath = arg;
        }
    }
    return options;
};
```

3. **Resolve store name**:

```typescript
const resolveStoreName = async (
    options: StoreCommandOptions,
    explicitName?: string
): Promise<Result<string, StoreCommandError>> => {
    // 1. Use explicit name if provided
    if (explicitName) {
        return validateStoreNameInput(explicitName);
    }

    // 2. Try git detection
    const gitName = await detectGitRepoName(options.cwd);
    if (gitName) {
        // Convert to valid store name (lowercase slug)
        const normalized = gitName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        return validateStoreNameInput(normalized);
    }

    // 3. Error: require --name
    return err({
        code: 'GIT_REPO_REQUIRED',
        message: 'Not in a git repository. Use --name to specify the store name.',
    });
};
```

4. **Check name collision**:

```typescript
const checkNameCollision = async (
    registryPath: string,
    name: string
): Promise<Result<void, StoreCommandError>> => {
    const registry = await loadRegistryOrEmpty(registryPath);
    if (!registry.ok) {
        return registry;
    }
    if (registry.value[name]) {
        return err({
            code: 'STORE_ALREADY_EXISTS',
            message: `Store '${name}' is already registered.`,
        });
    }
    return ok(undefined);
};
```

### Test Cases

- Parses `--name custom-name` correctly
- Uses git repo name when `--name` not provided
- Returns error when not in git repo and no `--name`
- Returns error when name already exists in registry
- Normalizes git repo name to valid store name format

---

## Task 3: Store Registration

### Objective

Automatically register the new store in the global registry after successful init.

### File Location

`src/cli/commands/store.ts`

### Changes Required

Update `runStoreInit` to:

1. Resolve store name
2. Check for collisions
3. Create store directory
4. Register in global registry

```typescript
const runStoreInit = async (
    options: StoreCommandOptions,
    initOptions?: StoreInitOptions
): Promise<StoreResult> => {
    // Resolve store name
    const nameResult = await resolveStoreName(options, initOptions?.name);
    if (!nameResult.ok) {
        return nameResult;
    }
    const storeName = nameResult.value;

    // Check for name collision
    const collisionCheck = await checkNameCollision(options.registryPath, storeName);
    if (!collisionCheck.ok) {
        return collisionCheck;
    }

    // Resolve target path
    const basePath = initOptions?.targetPath?.trim() || resolve(options.cwd, '.cortex');
    const rootPath = initOptions?.targetPath ? resolve(options.cwd, basePath) : basePath;
    const indexPath = resolve(rootPath, 'index.yaml');

    // Create store directory
    try {
        await mkdir(rootPath, { recursive: true });
        const serializedIndex = buildEmptyRootIndex();
        if (!serializedIndex.ok) {
            return serializedIndex;
        }
        await writeFile(indexPath, serializedIndex.value, 'utf8');
    } catch (error) {
        return err({
            code: 'STORE_INIT_FAILED',
            message: `Failed to initialize store at ${rootPath}.`,
            cause: error,
        });
    }

    // Register in global registry
    const registryResult = await loadRegistryOrEmpty(options.registryPath);
    if (!registryResult.ok) {
        return registryResult;
    }
    registryResult.value[storeName] = { path: rootPath };
    const saved = await saveRegistry(options.registryPath, registryResult.value);
    if (!saved.ok) {
        return saved;
    }

    return ok({
        output: {
            kind: 'store-init',
            value: formatStoreInit(rootPath, storeName), // Update to include name
        },
    });
};
```

### Output Format Update

Update `OutputStoreInit` to include name:

```typescript
// In src/cli/output.ts (check actual location)
export interface OutputStoreInit {
    path: string;
    name: string; // Add this
}

const formatStoreInit = (path: string, name: string): OutputStoreInit => ({ path, name });
```

### Test Cases

- Store is registered in global registry after init
- Registry file is created if it doesn't exist
- Correct path is stored in registry

---

## Task 4: Project Entry Creation

### Objective

Create a project entry memory in the default store for discoverability.

### File Location

`src/cli/commands/store.ts`

### Implementation Details

```typescript
import { getDefaultStorePath } from '../../core/config.ts'; // Or wherever config is
import { createMemory } from '../../core/memory.ts'; // Or appropriate module

/**
 * Creates a project entry in the default store.
 */
const createProjectEntry = async (
    options: StoreCommandOptions,
    storeName: string,
    storePath: string
): Promise<Result<void, StoreCommandError>> => {
    // Get default store path
    const defaultStorePath = await resolveDefaultStorePath(options);
    if (!defaultStorePath) {
        // Create default store if missing
        const created = await initializeDefaultStore(options);
        if (!created.ok) {
            return created;
        }
    }

    // Create project memory content
    const content = `# Project: ${storeName}

Store path: ${storePath}
Initialized: ${new Date().toISOString()}
`;

    // Use core memory creation function
    const memoryPath = `projects/${storeName}`;
    // Implementation depends on core memory API

    return ok(undefined);
};
```

### Note

This task requires investigating the core memory creation API. The implementation will use existing functions from `src/core/` to create the memory entry.

### Test Cases

- Project entry is created at `projects/{name}` in default store
- Entry contains project name and store path
- Default store is auto-created if missing

---

## Task 5: Tests

### File Location

`src/cli/commands/store.test.ts` (new file)

### Test Structure

```typescript
import { describe, test, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { runStoreCommand } from './store.ts';

describe('store init command', () => {
    let tempDir: string;
    let registryPath: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-store-test-'));
        registryPath = join(tempDir, 'stores.yaml');
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    describe('git detection', () => {
        test('detects git repo name', async () => {
            // Setup: Create a git repo in temp dir
            // ... init git repo
            // Test: run store init
            // Assert: store named after repo
        });

        test('returns null for non-git directory', async () => {
            // ...
        });
    });

    describe('--name flag', () => {
        test('uses explicit name when provided', async () => {
            // ...
        });

        test('overrides git detection', async () => {
            // ...
        });

        test('validates name format', async () => {
            // ...
        });
    });

    describe('name collision', () => {
        test('errors when name already registered', async () => {
            // Setup: Pre-register a store
            // Test: Try to init with same name
            // Assert: error
        });
    });

    describe('registration', () => {
        test('registers store in global registry', async () => {
            // ...
        });

        test('creates registry file if missing', async () => {
            // ...
        });
    });

    describe('project entry', () => {
        test('creates project entry in default store', async () => {
            // ...
        });

        test('auto-creates default store if missing', async () => {
            // ...
        });
    });
});
```

---

## Execution Order

### Phase 1: Implementation (Sequential due to dependencies)

1. **Task 1**: Git detection helper - delegate to code-implementer
2. **Task 2**: CLI flag and validation - delegate to code-implementer (depends on Task 1)
3. **Task 3**: Store registration - delegate to code-implementer (depends on Task 2)
4. **Task 4**: Project entry creation - delegate to code-implementer (depends on Task 3)

### Phase 2: Testing (Can run parallel with later implementation tasks)

5. **Task 5**: Write comprehensive tests - delegate to code-test

### Phase 3: Review and Documentation

6. Code review all implementations
7. Add documentation comments

---

## Files to Modify

| File                             | Changes                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `src/cli/commands/store.ts`      | Add git detection, flag parsing, registration logic, project entry creation |
| `src/cli/output.ts`              | Update `OutputStoreInit` interface to include `name`                        |
| `src/cli/commands/store.test.ts` | New file with comprehensive tests                                           |

## Critical Considerations

1. **Cross-platform paths**: Use `node:path` functions, never hardcode slashes
2. **Test isolation**: Use `mkdtemp()` for unique temp directories
3. **Error handling**: Use `Result` types consistently
4. **Git command execution**: Handle Windows/Unix differences in shell spawning
