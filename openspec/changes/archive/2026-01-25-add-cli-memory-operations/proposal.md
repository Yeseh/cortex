# Change: Add CLI memory operations

## Why
Users need CLI workflows to create, read, update, move, and delete memories in a store.

## What Changes
- Provide add/show/update/remove/move CLI commands.
- Support multiple input methods for add/update.
- Auto-create categories only during add.
- Allow metadata updates including tags and expiry.

## Impact
- Affected specs: cli-memory
- Affected code: src/cli/commands/add.ts, update.ts, show.ts, remove.ts, move.ts
