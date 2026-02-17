---
{created_at: 2026-02-05T20:31:13.818Z,updated_at: 2026-02-17T19:13:48.833Z,tags: [runbook,debugging,mcp,cli,typescript],source: mcp}
---
# Debugging Cortex Locally

## Running CLI Commands
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

## Debugging MCP Tools with Direct TypeScript

When MCP tools behave unexpectedly, test the underlying functions directly by bypassing the MCP transport layer.

### Pattern
Create a temporary test script:
```typescript
// debug-test.ts
import { FilesystemStorageAdapter } from './packages/storage-fs/src/index.ts';
import { setDescription } from './packages/core/src/category/index.ts';

async function main() {
    const adapter = new FilesystemStorageAdapter({ 
        rootDirectory: '/path/to/.cortex/memory' 
    });
    const port = adapter.categories;
    
    const result = await setDescription(port, 'issues', 'Test description');
    console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
```

### Run
```bash
bun debug-test.ts
```

### Benefits
- Bypasses MCP transport layer
- Direct access to Result types and errors
- Can add breakpoints/logging
- Verifies core logic vs MCP wrapper issues

### Cleanup
```bash
rm debug-test.ts
```