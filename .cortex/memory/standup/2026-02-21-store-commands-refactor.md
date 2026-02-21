---
{created_at: 2026-02-21T15:34:59.638Z,updated_at: 2026-02-21T15:34:59.638Z,tags: [refactor,cli,store-commands,standup],source: mcp,expires_at: 2026-02-28T00:00:00.000Z}
---
# Store Commands Refactor - Completed

## What was done
Migrated all CLI store commands to use the new `CortexContext` pattern, aligning them with the memory commands that already follow this standard.

## Files changed
- `packages/cli/src/store/commands/list.ts` - Uses `ctx.stores` to list configured stores
- `packages/cli/src/store/commands/add.ts` - Uses config file operations via `ctx` 
- `packages/cli/src/store/commands/remove.ts` - Uses config file operations via `ctx`
- `packages/cli/src/store/commands/prune.ts` - Uses `ctx.cortex.getStore().root().prune()`
- `packages/cli/src/store/commands/reindexs.ts` - Uses `ctx.cortex.getStore().root().reindex()`
- `packages/cli/src/context.spec.ts` - Removed 500+ lines of obsolete tests for removed functions
- `packages/cli/src/create-cli-command.ts` - Cleaned up unused imports and dead code

## Pattern used
```typescript
// Handler signature
export async function handleCommand(
    ctx: CortexContext,
    storeName: string | undefined,
    options: CommandOptions,
    deps: HandlerDeps = {}
): Promise<void> {
    const storeResult = ctx.cortex.getStore(storeName ?? 'default');
    // ...
}

// Command action
export const command = new Command('name').action(async (options, command) => {
    const parentOpts = command.parent?.opts() as { store?: string } | undefined;
    const context = await createCliCommandContext();
    if (!context.ok()) {
        throwCliError(context.error);
    }
    await handleCommand(context.value, parentOpts?.store, options);
});
```

## Known issues (pre-existing, not introduced)
1. TypeScript error: `FilesystemStorageAdapter` missing `stores` and `config` properties required by `StorageAdapter` interface
2. CLI integration tests fail due to config setup issues (missing `kind` field in test store configs)
3. Handler unit tests have pre-existing failures (40 failures on main branch)

## Outstanding work for next session
1. Fix `StorageAdapter` interface mismatch - add `stores` and `config` to `FilesystemStorageAdapter`
2. Update CLI integration tests to create proper config files with `kind` field
3. Consider adding unit tests specifically for the store commands

## Branch info
- Committed to: `refactor/update-store-commands-to-new-standard` 
- Merged into: `jw/vacuuming`
- Worktree location: `.worktrees/update-store-commands`