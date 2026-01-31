## 1. Setup

- [x] 1.1 Add `commander` and `@commander-js/extra-typings` v14.x to dependencies
- [x] 1.2 Create directory structure for new CLI organization
- [x] 1.3 Create `src/cli/errors.ts` with error mapping utilities
- [x] 1.4 Create `src/cli/context.ts` with store resolution utilities
- [x] 1.5 Create `src/cli/paths.ts` with cross-platform path utilities

## 2. Core Infrastructure

- [x] 2.1 Create new `src/cli/program.ts` with Commander program setup
- [x] 2.2 Update `src/cli/run.ts` to use new program entry point

## 3. Memory Commands

- [x] 3.1 Create `src/cli/commands/memory/index.ts` command group with `-s, --store` option
- [x] 3.2 Implement `src/cli/commands/memory/add/command.ts`
- [x] 3.3 Implement `src/cli/commands/memory/show/command.ts`
- [x] 3.4 Implement `src/cli/commands/memory/update/command.ts`
- [x] 3.5 Implement `src/cli/commands/memory/remove/command.ts`
- [x] 3.6 Implement `src/cli/commands/memory/move/command.ts`
- [x] 3.7 Implement `src/cli/commands/memory/list/command.ts`

## 4. Store Commands

- [x] 4.1 Create `src/cli/commands/store/index.ts` command group with `-s, --store` option
- [x] 4.2 Implement `src/cli/commands/store/list/command.ts`
- [x] 4.3 Implement `src/cli/commands/store/add/command.ts`
- [x] 4.4 Implement `src/cli/commands/store/remove/command.ts`
- [x] 4.5 Implement `src/cli/commands/store/init/command.ts`
- [x] 4.6 Implement `src/cli/commands/store/prune/command.ts` (moved from top-level)
- [x] 4.7 Implement `src/cli/commands/store/reindex/command.ts` (moved from top-level)

## 5. Top-Level Commands

- [x] 5.1 Implement `src/cli/commands/init/command.ts`

## 6. Testing

- [x] 6.1 Create unit tests for error mapping utilities
- [x] 6.2 Create unit tests for context/store resolution
- [x] 6.3 Create integration tests for memory commands (rewritten for new structure)
- [x] 6.4 Create integration tests for store commands (rewritten for new structure)
- [x] 6.5 Create integration tests for init command (rewritten for new structure)
- [x] 6.6 Verify all existing test scenarios pass with new structure (829 tests passing)

## 7. Cleanup

- [x] 7.1 Remove old command files (`src/cli/commands/add.ts`, `show.ts`, etc.)
- [x] 7.2 Remove `src/cli/commands/help.ts` (Commander generates help)
- [x] 7.3 Remove old `src/cli/index.ts` (replaced by `program.ts`)
- [x] 7.4 Remove old test files for deleted commands
- [x] 7.5 Input utilities preserved in `src/cli/input.ts` (still used by new commands)

## 8. Documentation

- [x] 8.1 Update README with new command syntax
- [x] 8.2 Add migration notes for users upgrading from previous versions
