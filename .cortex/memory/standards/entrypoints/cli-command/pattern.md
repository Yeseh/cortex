---
created_at: 2026-01-29T20:11:45.551Z
updated_at: 2026-02-05T19:20:57.879Z
tags:
  - cli
  - testing
  - patterns
  - dependency-injection
source: mcp
---
# CLI Command Handler Pattern

Commands follow a consistent pattern enabling testability via dependency injection.

## Pattern Structure
```typescript
// 1. Options interface
export interface CommandOptions {
    content?: string;
    format?: string;
}

// 2. Handler dependencies (for testing)
export interface HandlerDeps {
    stdout?: NodeJS.WritableStream;
    stdin?: NodeJS.ReadableStream;
    now?: Date;
    adapter?: ScopedStorageAdapter;
}

// 3. Handler function (exported for testing)
export async function handleCommand(
    arg: string,
    options: CommandOptions,
    storeName: string | undefined,
    deps: HandlerDeps = {},
): Promise<void> {
    // Implementation - pure logic, injectable dependencies
}

// 4. Commander command definition
export const command = new Command('name')
    .description('Description')
    .argument('<arg>')
    .option('-o, --option <value>')
    .action(async (arg, options, command) => {
        const parentOpts = command.parent?.opts();
        await handleCommand(arg, options, parentOpts?.store);
    });
```

## Dependency Injection
Handlers accept optional `deps` parameter for testability:
- `stdin`: NodeJS.ReadableStream (default: process.stdin)
- `stdout`: NodeJS.WritableStream (default: process.stdout)
- `now`: Date (default: new Date())
- `adapter`: ScopedStorageAdapter (for testing without real filesystem)

## Error Handling
Use `mapCoreError()` to convert domain errors to Commander exceptions:
- `InvalidArgumentError` - for user input errors (shows usage help)
- `CommanderError` - for system errors (shows error only)

## Benefits
- Handlers are testable without Commander
- Dependencies injectable via HandlerDeps
- Consistent structure across all commands
- Parent options accessed via command.parent?.opts()