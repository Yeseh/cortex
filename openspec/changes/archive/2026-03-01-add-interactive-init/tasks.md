## Implementation Tasks

- [x] 1.1 Add `@inquirer/prompts` to `packages/cli/package.json` dependencies
- [x] 1.2 Run `bun install` to update lockfile
- [x] 2.1 Write failing tests for `isTTY` in `packages/cli/src/prompts.spec.ts`
- [x] 2.2 Create `packages/cli/src/prompts.ts` with `PromptDeps`, `defaultPromptDeps`, `isTTY`
- [x] 3.1 Add interactive mode tests to `packages/cli/src/commands/init.spec.ts`
- [x] 3.2 Implement `promptInitOptions()` in `packages/cli/src/commands/init.ts`
- [x] 3.3 Thread prompted store name through `ensureNotInitialized` and `createGlobalStore`
- [x] 4.1 Add interactive mode tests to `packages/cli/src/store/commands/init.spec.ts`
- [x] 4.2 Implement `promptStoreInitOptions()` in `packages/cli/src/store/commands/init.ts`
- [x] 4.3 Wrap `resolveStoreName` in try-catch with TTY fallback
- [x] 5.1 Create OpenSpec change `add-interactive-init`
