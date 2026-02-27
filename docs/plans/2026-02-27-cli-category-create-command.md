# CLI Category Create Command Implementation Plan

**Goal:** Add a `cortex category create <path>` command to the CLI that creates a category (and its ancestors) in a named store.
**Architecture:** Thin Commander.js wrapper following the same pattern as `memory` and `store` command groups — group command in `packages/cli/src/category/`, handler exported for unit testing, no business logic in the handler beyond error mapping.
**Tech Stack:** Commander.js (`@commander-js/extra-typings`), `@yeseh/cortex-core` (`CategoryClient.create()`), Bun test.
**Session Id:** ses_35f11e407ffe7LOi2HzGt976NM

---

## Background

The `cortex memory add` command fails if the target category doesn't exist, and the error message tells the user to run `cortex category create <path>`. That command doesn't exist yet. This plan adds it.

### Relevant files to read before starting

- `packages/cli/src/memory/index.ts` — group command pattern
- `packages/cli/src/memory/commands/add.ts` — handler pattern (DI via CortexContext)
- `packages/cli/src/memory/commands/test-helpers.spec.ts` — shared mock factory and CaptureStream
- `packages/cli/src/memory/commands/add.spec.ts` — test pattern
- `packages/cli/src/store/commands/init.ts` — pattern for format option + output serialization
- `packages/cli/src/program.ts` — where to wire in the new command group
- `packages/core/src/category/category-client.ts:373` — `CategoryClient.create(modeContext?)`
- `packages/core/src/category/types.ts` — `CreateCategoryResult`, `CategoryErrorCode`
- `packages/core/src/category/operations/create.ts` — what the core operation does

### Core API

```typescript
// Getting a CategoryClient for a path from a StoreClient:
const storeResult = ctx.cortex.getStore(storeName ?? 'default');
const store = storeResult.value; // StoreClient
const rootResult = store.root(); // CategoryResult<CategoryClient>
const categoryClient = rootResult.value.getCategory('standards/typescript');

// Creating:
const result = await categoryClient.create(); // CategoryResult<CreateCategoryResult>
// result.value = { path: 'standards/typescript', created: true|false }
```

### Error codes to map

| Core code                   | Commander translation  |
| --------------------------- | ---------------------- |
| `INVALID_PATH`              | `InvalidArgumentError` |
| `ROOT_CATEGORY_NOT_ALLOWED` | `InvalidArgumentError` |
| `CATEGORY_PROTECTED`        | `InvalidArgumentError` |
| all others                  | `CommanderError`       |

---

## Tasks

### 1. Scaffold `packages/cli/src/category/`

**1.1** Create `packages/cli/src/category/commands/` directory (just create it, no files yet).

**1.2** Create `packages/cli/src/category/index.ts` — group command that wires subcommands:

```typescript
// packages/cli/src/category/index.ts
import { Command } from '@commander-js/extra-typings';
import { createCommand } from './commands/create.ts';

export const categoryCommand = new Command('category')
    .description('Category operations')
    .option('-s, --store <name>', 'Use a specific named store');

categoryCommand.addCommand(createCommand);
```

### 2. Implement `packages/cli/src/category/commands/create.ts`

Full file — follow the handler + exported Command pattern:

```typescript
/**
 * Category create command.
 * ...JSDoc...
 */
import { Command } from '@commander-js/extra-typings';
import { throwCliError } from '../../errors.ts';
import { type CortexContext } from '@yeseh/cortex-core';
import { serializeOutput, type OutputFormat } from '../../output.ts';
import { createCliCommandContext } from '../../create-cli-command.ts';

export interface CreateCommandOptions {
    description?: string;
    format?: string;
}

export async function handleCreate(
    ctx: CortexContext,
    storeName: string | undefined,
    path: string,
    options: CreateCommandOptions = {}
): Promise<void> {
    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    if (!storeResult.ok()) {
        throwCliError(storeResult.error);
    }

    const rootResult = storeResult.value.root();
    if (!rootResult.ok()) {
        throwCliError(rootResult.error);
    }

    const categoryClient = rootResult.value.getCategory(path);
    if (!categoryClient.ok()) {
        throwCliError(categoryClient.error);
    }

    const result = await categoryClient.value.create();
    if (!result.ok()) {
        throwCliError(result.error);
    }

    const { path: createdPath, created } = result.value;
    const out = ctx.stdout ?? process.stdout;

    const rawFormat = options.format;
    if (!rawFormat) {
        const verb = created ? 'Created' : 'Category already exists:';
        out.write(`${verb} ${createdPath}\n`);
    } else {
        const serialized = serializeOutput(
            { path: createdPath, created },
            rawFormat as OutputFormat
        );
        if (!serialized.ok()) {
            throwCliError({ code: 'SERIALIZE_FAILED', message: serialized.error.message });
        }
        out.write(serialized.value + '\n');
    }
}

export const createCommand = new Command('create')
    .description('Create a category (and any missing ancestors)')
    .argument('<path>', 'Category path (e.g., standards/typescript)')
    .option('-d, --description <text>', 'Optional description for the category')
    .option('-o, --format <format>', 'Output format (yaml, json, toon)')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts() as { store?: string } | undefined;
        const context = await createCliCommandContext();
        if (!context.ok()) {
            throwCliError(context.error);
        }
        await handleCreate(context.value, parentOpts?.store, path, options);
    });
```

> Note: `--description` is parsed but not passed to `CategoryClient.create()` — the core `createCategory` operation does not accept a description. Setting a description is a separate `set-description` operation. For now, accept the option and ignore it (or add a follow-up `setDescription` call if desired). Document this clearly.

**2.1** Write the file.

**2.2** Run `bunx tsc --build` — should compile clean.

### 3. Write tests: `packages/cli/src/category/commands/create.spec.ts`

Import from `../../memory/commands/test-helpers.spec.ts` (reuse `createMemoryCommandContext`, `createMockMemoryCommandAdapter`, `createCaptureStream`).

Test cases to write:

**3.1** `should write "Created <path>" to stdout when category is new`

- `categories.exists` returns `ok(false)`, `ensure` returns `ok(undefined)`
- Expect output contains "Created" and the path

**3.2** `should write "already exists" message when category exists`

- `categories.exists` returns `ok(true)`
- Expect output contains the path (not an error)

**3.3** `should serialize as JSON when --format json is passed`

- Call `handleCreate(ctx, undefined, 'standards', { format: 'json' })`
- Expect output to be valid JSON containing `"path"` and `"created"`

**3.4** `should throw CommanderError when store not found`

- Pass `storeName = 'nonexistent'` with a factory that returns undefined
- Expect `rejects.toThrow(CommanderError)`

**3.5** `should throw InvalidArgumentError for empty path`

- Pass `path = ''`
- Expect `rejects.toThrow(InvalidArgumentError)` (core returns `INVALID_PATH`)

**3.6** `should throw CommanderError when storage ensure fails`

- `categories.exists` returns `ok(false)`, `ensure` returns an error
- Expect `rejects.toThrow(CommanderError)`

**3.7** Run `bun test packages/cli/src/category` — all 6 pass.

### 4. Wire into `packages/cli/src/program.ts`

**4.1** Add import: `import { categoryCommand } from './category/index.ts';`

**4.2** Add: `program.addCommand(categoryCommand);`

**4.3** Run `bunx tsc --build` — clean.

### 5. Smoke-test manually

```bash
export CORTEX_CONFIG_DIR=/tmp/smoke-test/config
export CORTEX_CONFIG_CWD=/tmp/smoke-test/workdir
mkdir -p $CORTEX_CONFIG_DIR $CORTEX_CONFIG_CWD
bun run packages/cli/src/run.ts init
bun run packages/cli/src/run.ts category --store global create standards
bun run packages/cli/src/run.ts category --store global create standards --format json
bun run packages/cli/src/run.ts memory --store global add standards/test -c "hello"
```

### 6. Final check

**6.1** Run `bun test packages/cli` — all pass.
**6.2** Run `bunx tsc --build` — clean.
**6.3** Run `bunx eslint packages/cli/src/category/**/*.ts --fix`.
**6.4** Commit: `feat(cli): add category create command`

---

## Out of scope

- `category delete`, `category list`, `category set-description` — separate tasks
- Description passing to core (`setDescription` call) — followup
- MCP `cortex_create_category` tool — separate task
