## 1. Setup

- [ ] 1.1 Add `commander` and `@commander-js/extra-typings` v14.x to dependencies
- [ ] 1.2 Create directory structure for new CLI organization
- [ ] 1.3 Create `src/cli/errors.ts` with error mapping utilities
- [ ] 1.4 Create `src/cli/context.ts` with store resolution utilities

## 2. Core Infrastructure

- [ ] 2.1 Create new `src/cli/index.ts` with Commander program setup
- [ ] 2.2 Update `src/cli/run.ts` to use new program entry point

## 3. Memory Commands

- [ ] 3.1 Create `src/cli/commands/memory/index.ts` command group with `-s, --store` option
- [ ] 3.2 Implement `src/cli/commands/memory/add/command.ts`
- [ ] 3.3 Implement `src/cli/commands/memory/show/command.ts`
- [ ] 3.4 Implement `src/cli/commands/memory/update/command.ts`
- [ ] 3.5 Implement `src/cli/commands/memory/remove/command.ts`
- [ ] 3.6 Implement `src/cli/commands/memory/move/command.ts`
- [ ] 3.7 Implement `src/cli/commands/memory/list/command.ts`

## 4. Store Commands

- [ ] 4.1 Create `src/cli/commands/store/index.ts` command group with `-s, --store` option
- [ ] 4.2 Implement `src/cli/commands/store/list/command.ts`
- [ ] 4.3 Implement `src/cli/commands/store/add/command.ts`
- [ ] 4.4 Implement `src/cli/commands/store/remove/command.ts`
- [ ] 4.5 Implement `src/cli/commands/store/init/command.ts`
- [ ] 4.6 Implement `src/cli/commands/store/prune/command.ts` (moved from top-level)
- [ ] 4.7 Implement `src/cli/commands/store/reindex/command.ts` (moved from top-level)

## 5. Top-Level Commands

- [ ] 5.1 Implement `src/cli/commands/init/command.ts`

## 6. Testing

- [ ] 6.1 Create unit tests for error mapping utilities
- [ ] 6.2 Create unit tests for context/store resolution
- [ ] 6.3 Create integration tests for memory commands
- [ ] 6.4 Create integration tests for store commands
- [ ] 6.5 Create integration tests for init command
- [ ] 6.6 Verify all existing test scenarios pass with new structure

## 7. Cleanup

- [ ] 7.1 Remove old command files (`src/cli/commands/add.ts`, `show.ts`, etc.)
- [ ] 7.2 Remove `src/cli/commands/help.ts` (Commander generates help)
- [ ] 7.3 Remove old `src/cli/input.ts` if no longer needed (or refactor into context.ts)
- [ ] 7.4 Remove old test files for deleted commands
- [ ] 7.5 Clean up any unused exports from old `src/cli/index.ts`

## 8. Documentation

- [ ] 8.1 Update README with new command syntax
- [ ] 8.2 Add migration notes for users upgrading from previous versions
