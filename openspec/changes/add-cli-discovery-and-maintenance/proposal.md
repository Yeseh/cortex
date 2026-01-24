# Change: Add CLI discovery and maintenance

## Why
Users need commands to browse memories and manage expired content.

## What Changes
- Provide list and prune CLI commands.
- Hide expired memories by default with an include-expired option.

## Impact
- Affected specs: cli-maintenance
- Affected code: src/cli/commands/list.ts, prune.ts
