---
created_at: 2026-02-05T19:15:30.896Z
updated_at: 2026-02-05T19:15:30.896Z
tags:
  - map
  - cli
  - files
source: mcp
---
# CLI Package Key Files

## Entry Points (`packages/cli/src/`)
- `run.ts` - CLI entry point (shebang script)
- `program.ts` - Commander.js program setup, runProgram()

## Infrastructure
- `context.ts` - Store resolution: resolveStoreContext(), resolveStoreAdapter()
- `errors.ts` - Error mapping: mapCoreError() → Commander exceptions
- `output.ts` - Output formatting: OutputPayload, serializeOutput()
- `input.ts` - Content input: resolveContent() for --content, --file, stdin
- `paths.ts` - Cross-platform paths with tilde expansion
- `toon.ts` - TOON encoder for LLM-friendly output

## Command Files
- `commands/init/command.ts` - cortex init
- `commands/memory/index.ts` - Memory command group with --store option
- `commands/memory/add/command.ts` - cortex memory add
- `commands/memory/show/command.ts` - cortex memory show
- `commands/memory/list/command.ts` - cortex memory list
- `commands/memory/update/command.ts` - cortex memory update
- `commands/memory/remove/command.ts` - cortex memory remove
- `commands/memory/move/command.ts` - cortex memory move
- `commands/store/index.ts` - Store command group
- `commands/store/list/command.ts` - cortex store list
- `commands/store/add/command.ts` - cortex store add
- `commands/store/init/command.ts` - cortex store init
- `commands/store/prune/command.ts` - cortex store prune
- `commands/store/reindex/command.ts` - cortex store reindex