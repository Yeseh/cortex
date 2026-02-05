---
created_at: 2026-02-05T18:08:23.213Z
updated_at: 2026-02-05T18:11:41.204Z
tags:
  - runbook
  - cli
  - debugging
source: mcp
---
# Running Cortex CLI Locally

Run CLI commands via bun from the repository root:

```bash
bun run packages/cli/src/run.ts <command>
```

Examples:
```bash
bun run packages/cli/src/run.ts store list
bun run packages/cli/src/run.ts store prune --store cortex --dry-run
bun run packages/cli/src/run.ts memory list --store cortex
```