---
created_at: 2026-01-29T20:11:45.551Z
updated_at: 2026-01-29T20:11:45.551Z
tags:
  - cli
  - testing
  - patterns
  - dependency-injection
source: mcp
---
# CLI Command Pattern

## Handler Separation
Command handlers are separated from Commander configuration for testability:

```typescript
// Handler - pure logic, injectable dependencies
export async function handleAdd(
    path: string,
    options: AddCommandOptions,
    storeName: string | undefined,
    deps: AddHandlerDeps = {},  // stdin, stdout, now
): Promise<void> { ... }

// Command - Commander configuration only
export const addCommand = new Command('add')
    .argument('<path>')
    .option('-c, --content <text>')
    .action(async (path, options, command) => {
        const parentOpts = command.parent?.opts();
        await handleAdd(path, options, parentOpts?.store);
    });
```

## Dependency Injection
Handlers accept optional `deps` parameter for testability:
- `stdin`: NodeJS.ReadableStream (default: process.stdin)
- `stdout`: NodeJS.WritableStream (default: process.stdout)
- `now`: Date (default: new Date())

## Error Handling
Use `mapCoreError()` to convert domain errors to Commander exceptions:
- `InvalidArgumentError` - for user input errors (shows usage help)
- `CommanderError` - for system errors (shows error only)