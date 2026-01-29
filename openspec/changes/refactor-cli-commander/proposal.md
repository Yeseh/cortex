# Change: Refactor CLI to Commander.js with Nested Commands

## Why

The current CLI implementation uses custom argument parsing (~500 lines in `index.ts` alone) with manual flag handling, help text maintenance, and routing logic. This is error-prone, hard to maintain, and lacks features like auto-generated help and shell completions. Commander.js is the industry standard for Node.js CLIs and would eliminate most of this boilerplate while providing better UX.

## What Changes

- **BREAKING**: Flat commands (`cortex add`) become nested (`cortex memory add`)
- Adopt Commander.js with `@commander-js/extra-typings` for type safety
- Restructure `src/cli/commands/` into domain-grouped folders
- Move `prune` and `reindex` from top-level to `store` domain
- Switch from errors-as-values to Commander's exception-based model in CLI layer
- Remove manual help text; let Commander generate help
- Add consistent short flags across all commands
- Remove `--global-store` flag (can use env var if needed later)

## Impact

- Affected specs: `cli-memory`, `cli-store`, `cli-maintenance`
- Affected code: `src/cli/**/*` (complete rewrite of CLI layer)
- User-facing: All command invocations change (hard break, no backward compatibility)

## Command Structure

```
cortex init                        # Top-level global setup
cortex memory add <path>           # Memory CRUD operations
cortex memory show <path>
cortex memory update <path>
cortex memory remove <path>
cortex memory move <from> <to>
cortex memory list [category]
cortex store list                  # Store management
cortex store add <name> <path>
cortex store remove <name>
cortex store init [path]
cortex store prune                 # Maintenance (moved from top-level)
cortex store reindex
```

## Short Flag Standards

| Long Flag           | Short | Used In                       |
| ------------------- | ----- | ----------------------------- |
| `--store`           | `-s`  | `memory` group, `store` group |
| `--content`         | `-c`  | `memory add`, `memory update` |
| `--file`            | `-f`  | `memory add`, `memory update` |
| `--tags`            | `-t`  | `memory add`, `memory update` |
| `--expires-at`      | `-e`  | `memory add`, `memory update` |
| `--clear-expiry`    | `-E`  | `memory update`               |
| `--include-expired` | `-x`  | `memory list`, `memory show`  |
| `--format`          | `-o`  | `memory list`, `memory show`  |
| `--name`            | `-n`  | `store init`                  |
| `--force`           | `-F`  | `init`                        |

## Dependencies

Add to `package.json`:

```json
{
    "dependencies": {
        "commander": "^14.x",
        "@commander-js/extra-typings": "^14.x"
    }
}
```
