# Design: CLI Commander.js Restructure

## Context

The current CLI implementation has grown organically with custom argument parsing spread across multiple files. Each command implements its own flag parsing logic, leading to inconsistencies and maintenance burden. The help text is manually maintained in a separate file, often falling out of sync with actual command behavior.

Commander.js is the de-facto standard for Node.js CLI applications, used by major tools like npm, yarn, and webpack. It provides declarative command definition, automatic help generation, type-safe options with `@commander-js/extra-typings`, and a well-tested argument parsing engine.

## Goals

- Reduce CLI boilerplate by 60%+ through Commander.js adoption
- Provide consistent, auto-generated help across all commands
- Enable future features like shell completions
- Improve developer experience with type-safe option interfaces
- Organize commands by domain for better discoverability

## Non-Goals

- Backward compatibility with old command syntax
- Custom help formatting beyond Commander's defaults
- Plugin/extension system for third-party commands

## Decisions

### 1. Nested Command Structure

**Decision**: Organize commands under domain groups (`memory`, `store`).

**Alternatives considered**:

- Keep flat structure with Commander: Simpler migration but loses organizational benefits
- Deep nesting (e.g., `cortex memory crud add`): Over-engineered for current command count

**Rationale**: Domain grouping improves discoverability and scales better as commands grow. Two levels (`cortex <domain> <action>`) is the sweet spot for CLI ergonomics.

### 2. Exception-Based Error Handling in CLI Layer

**Decision**: Use Commander's exception model; map core Result errors to Commander exceptions.

**Alternatives considered**:

- Keep Result types throughout: Fights against Commander's design, verbose
- Throw everywhere: Loses benefits of Result types in core domain

**Rationale**: The CLI is a thin adapter layer. Core business logic keeps Result types for testability and explicit error handling. The CLI layer maps these to exceptions that Commander understands.

### 3. Single `command.ts` File Per Command

**Decision**: Each command lives in `<domain>/<action>/command.ts` with additional files only when needed.

**Alternatives considered**:

- Split into command.ts + handler.ts + types.ts: Over-engineered for simple commands
- Single file per domain: Commands become too large to navigate

**Rationale**: Most commands are simple wiring between Commander and core functions. A single file keeps related code together. Complex commands can add types.ts or utils.ts as needed.

### 4. Domain-Level `--store` Option

**Decision**: Define `--store` on the `memory` and `store` command groups, inherited by subcommands.

**Alternatives considered**:

- Program-level: Would apply to `init` which doesn't need it
- Command-level repetition: Violates DRY, inconsistent placement

**Rationale**: Store selection is domain-specific. Memory commands and store maintenance commands need it; global init does not.

### 5. Remove `--global-store` Flag

**Decision**: Remove the flag entirely; support via environment variable if needed later.

**Rationale**: The flag was rarely used and adds complexity. Environment variable (`CORTEX_GLOBAL_STORE`) can serve power users without cluttering the CLI.

## File Structure

```
src/cli/
├── index.ts                           # Program setup, wires command groups
├── run.ts                             # Entry point (minimal changes)
├── errors.ts                          # Maps core Result errors → Commander exceptions
├── context.ts                         # Store resolution utilities
├── commands/
│   ├── init/
│   │   └── command.ts                 # Global init command
│   ├── memory/
│   │   ├── index.ts                   # 'memory' command group definition
│   │   ├── add/
│   │   │   └── command.ts
│   │   ├── show/
│   │   │   └── command.ts
│   │   ├── update/
│   │   │   └── command.ts
│   │   ├── remove/
│   │   │   └── command.ts
│   │   ├── move/
│   │   │   └── command.ts
│   │   └── list/
│   │       └── command.ts
│   └── store/
│       ├── index.ts                   # 'store' command group definition
│       ├── list/
│       │   └── command.ts
│       ├── add/
│       │   └── command.ts
│       ├── remove/
│       │   └── command.ts
│       ├── init/
│       │   └── command.ts
│       ├── prune/
│       │   └── command.ts
│       └── reindex/
│           └── command.ts
```

## Implementation Patterns

### Entry Point

```typescript
// src/cli/index.ts
import { Command } from '@commander-js/extra-typings';
import { memoryCommand } from './commands/memory/index.ts';
import { storeCommand } from './commands/store/index.ts';
import { initCommand } from './commands/init/command.ts';

const program = new Command()
    .name('cortex')
    .description('Memory system for AI agents')
    .version('0.1.0');

program.addCommand(memoryCommand);
program.addCommand(storeCommand);
program.addCommand(initCommand);

export { program };
```

### Domain Group

```typescript
// src/cli/commands/memory/index.ts
import { Command } from '@commander-js/extra-typings';
import { addCommand } from './add/command.ts';
import { showCommand } from './show/command.ts';
// ... other imports

export const memoryCommand = new Command('memory')
    .description('Memory operations')
    .option('-s, --store <name>', 'Use a specific named store');

memoryCommand.addCommand(addCommand);
memoryCommand.addCommand(showCommand);
// ... other subcommands
```

### Command File

Each command file exports both the Commander command definition and an extracted handler function. The handler contains all the CLI-specific logic (option parsing, store resolution, error mapping) and is independently testable.

```typescript
// src/cli/commands/memory/add/command.ts
import { Command } from '@commander-js/extra-typings';
import { addMemory } from '../../../../core/memory/operations.ts';
import { mapCoreError } from '../../../errors.ts';
import { resolveStoreContext } from '../../../context.ts';

/** Options parsed by Commander for the add command */
export interface AddCommandOptions {
    content?: string;
    file?: string;
    tags?: string;
    expiresAt?: string;
}

/** Dependencies injected into the handler for testability */
export interface AddHandlerDeps {
    stdin?: NodeJS.ReadableStream;
    stdout?: NodeJS.WritableStream;
}

/**
 * Handler for the memory add command.
 * Exported for direct testing without Commander parsing.
 */
export async function handleAdd(
    path: string,
    options: AddCommandOptions,
    storeName: string | undefined,
    deps: AddHandlerDeps = {}
): Promise<void> {
    const context = await resolveStoreContext(storeName);

    const result = await addMemory({
        storeRoot: context.root,
        path,
        content: options.content,
        filePath: options.file,
        tags: options.tags?.split(',').map((t) => t.trim()),
        expiresAt: options.expiresAt ? new Date(options.expiresAt) : undefined,
        stdin: deps.stdin ?? process.stdin,
    });

    if (!result.ok) {
        mapCoreError(result.error); // throws Commander exception
    }

    const out = deps.stdout ?? process.stdout;
    out.write(result.value.message + '\n');
}

export const addCommand = new Command('add')
    .description('Create a new memory')
    .argument('<path>', 'Memory path (e.g., project/tech-stack)')
    .option('-c, --content <text>', 'Memory content as inline text')
    .option('-f, --file <filepath>', 'Read content from a file')
    .option('-t, --tags <tags>', 'Comma-separated tags')
    .option('-e, --expires-at <date>', 'Expiration date (ISO 8601)')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts();
        await handleAdd(path, options, parentOpts?.store);
    });
```

### Error Mapping

```typescript
// src/cli/errors.ts
import { InvalidArgumentError, CommanderError } from '@commander-js/extra-typings';

interface CoreError {
    code: string;
    message: string;
}

const ARGUMENT_ERROR_CODES = new Set([
    'INVALID_PATH',
    'INVALID_ARGUMENTS',
    'INVALID_STORE_NAME',
    'INVALID_STORE_PATH',
    'MISSING_CONTENT',
    'MULTIPLE_CONTENT_SOURCES',
]);

export function mapCoreError(error: CoreError): never {
    if (ARGUMENT_ERROR_CODES.has(error.code)) {
        throw new InvalidArgumentError(error.message);
    }

    throw new CommanderError(1, error.code, error.message);
}
```

## Testing Strategy

### Unit Tests (Handler Logic)

Test the exported handler function directly, which covers CLI-specific logic like option parsing, tag splitting, date conversion, and error mapping:

```typescript
// src/cli/commands/memory/add/command.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { handleAdd } from './command.ts';

describe('handleAdd', () => {
    const testStore = '/tmp/test-store-add';

    beforeEach(async () => {
        await mkdir(testStore, { recursive: true });
    });

    afterEach(async () => {
        await rm(testStore, { recursive: true, force: true });
    });

    it('creates memory with inline content', async () => {
        const output: string[] = [];
        const mockStdout = {
            write: (msg: string) => {
                output.push(msg);
                return true;
            },
        } as NodeJS.WritableStream;

        await handleAdd(
            'test/memory',
            { content: 'Test content' },
            undefined, // no store override
            { stdout: mockStdout }
        );

        expect(output.join('')).toContain('Added memory');
    });

    it('parses comma-separated tags correctly', async () => {
        const output: string[] = [];
        const mockStdout = {
            write: (msg: string) => {
                output.push(msg);
                return true;
            },
        } as NodeJS.WritableStream;

        await handleAdd(
            'test/tagged',
            { content: 'Tagged content', tags: 'foo, bar, baz' },
            undefined,
            { stdout: mockStdout }
        );

        // Verify tags were parsed (would need to read back memory to fully verify)
        expect(output.join('')).toContain('Added memory');
    });

    it('throws InvalidArgumentError for invalid path', async () => {
        await expect(handleAdd('', { content: 'Test' }, undefined)).rejects.toThrow();
    });

    it('throws InvalidArgumentError for missing content', async () => {
        await expect(handleAdd('test/empty', {}, undefined)).rejects.toThrow();
    });

    it('parses ISO date for expires-at option', async () => {
        const output: string[] = [];
        const mockStdout = {
            write: (msg: string) => {
                output.push(msg);
                return true;
            },
        } as NodeJS.WritableStream;

        await handleAdd(
            'test/expiring',
            { content: 'Expiring content', expiresAt: '2026-12-31T00:00:00Z' },
            undefined,
            { stdout: mockStdout }
        );

        expect(output.join('')).toContain('Added memory');
    });
});
```

### Integration Tests (Full Command Parsing)

Test complete flow including Commander argument parsing:

```typescript
// src/cli/commands/memory/add/command.integration.spec.ts
import { describe, it, expect } from 'bun:test';
import { program } from '../../../index.ts';

describe('cortex memory add', () => {
    it('parses arguments and options correctly', async () => {
        // Mock or use temp directory
        await program.parseAsync([
            'node',
            'cortex',
            'memory',
            'add',
            'test/path',
            '-c',
            'Hello world',
            '-t',
            'foo,bar',
        ]);
    });

    it('shows error for missing path', async () => {
        await expect(program.parseAsync(['node', 'cortex', 'memory', 'add'])).rejects.toThrow();
    });

    it('supports long flag names', async () => {
        await program.parseAsync([
            'node',
            'cortex',
            'memory',
            'add',
            'test/path',
            '--content',
            'Hello world',
            '--tags',
            'foo,bar',
            '--expires-at',
            '2026-12-31',
        ]);
    });
});
```

## Risks / Trade-offs

| Risk                               | Mitigation                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| Breaking change for existing users | Document migration path clearly; major version bump                            |
| Commander version updates          | Pin to major version; `@commander-js/extra-typings` matches Commander versions |
| Learning curve for contributors    | Commander is well-documented; patterns are consistent across commands          |

## Migration Plan

1. Add Commander dependencies
2. Create new directory structure alongside existing code
3. Implement shared utilities (`errors.ts`, `context.ts`)
4. Migrate commands one by one, starting with simplest (`list`, `show`)
5. Wire up new entry point
6. Update/add tests for new structure
7. Remove old implementation files
8. Update documentation

## Open Questions

None - all questions resolved during brainstorming session.
