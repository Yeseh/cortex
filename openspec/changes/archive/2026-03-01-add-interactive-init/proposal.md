# Change: Add interactive prompts to init commands

## Why

When running `cortex init` or `cortex store init` in a terminal, users currently must pass all options as flags or accept defaults silently. Adding TTY-aware interactive prompts improves first-run UX by letting users confirm or change the resolved path and store name before anything is written to disk.

## What Changes

- `cortex init` prompts for global store path and store name when stdin is a TTY
- `cortex store init` prompts for store name and path when stdin is a TTY
- Non-TTY environments (CI, pipes, scripts) are completely unaffected — no behavioral regression
- Prompts are skipped when values are already provided explicitly (e.g. `--name my-store ./path`)
- A new shared `prompts.ts` module provides `isTTY()`, `PromptDeps` injection pattern
- `@inquirer/prompts` added as a dependency of `packages/cli`

## Impact

- Affected specs: `cli-store` (Store Init Command, Global Init Command)
- Affected code: `packages/cli/src/commands/init.ts`, `packages/cli/src/store/commands/init.ts`, `packages/cli/src/prompts.ts`
