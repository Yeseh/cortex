# CLI Memory Commands Cleanup Implementation Plan

**Goal:** Align all memory CLI commands with the add.ts standard for consistent context handling, parsing, and output behaviors.
**Architecture:** Update each command to use the same context resolution patterns as add.ts (createCliCommandContext, ctx.cortex store access, explicit path validation) and consistent option parsing. Add or update tests to validate handlers and command wiring.
**Tech Stack:** TypeScript (Bun), Commander.js, Cortex core APIs, Bun test
**Session Id:** undefined

---

## Implementation Tasks

1. Document add.ts standards (context resolution, MemoryPath validation, option parsing, output behavior) for reference in other commands.
2. Update list command to match add.ts patterns: context creation, store resolution via ctx.cortex, path validation, output formatting, error handling.
3. Update show command to match add.ts patterns: context creation, store resolution via ctx.cortex, path validation, consistent output formatting.
4. Update move command to match add.ts patterns: context creation, store resolution via ctx.cortex, path validation, normalized output.
5. Update remove command to match add.ts patterns: context creation, store resolution via ctx.cortex, path validation, normalized output.
6. Update update command to match add.ts patterns: context creation, store resolution via ctx.cortex, option parsing helpers, consistent output.

## Testing Tasks

7. Add/adjust unit tests for updated command handlers (list/show/move/remove/update) to cover success and error paths aligned with new patterns.
8. Run targeted CLI tests for memory commands (or full cli test suite) and capture results.
