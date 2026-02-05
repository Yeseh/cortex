---
created_at: 2026-02-05T20:31:13.818Z
updated_at: 2026-02-05T20:31:13.818Z
tags:
  - runbook
  - debugging
  - mcp
  - typescript
source: mcp
---
# Debugging MCP Tools with Direct TypeScript

When MCP tools behave unexpectedly, test the underlying functions directly.

## Pattern

Create a temporary test script using direct TypeScript imports:

```typescript
// debug-test.ts
import { FilesystemStorageAdapter } from './packages/storage-fs/src/index.ts';
import { setDescription } from './packages/core/src/category/index.ts';

async function main() {
    const adapter = new FilesystemStorageAdapter({ 
        rootDirectory: 'F:/repo/cortex/.cortex/memory' 
    });
    const port = adapter.categories;
    
    const result = await setDescription(port, 'issues', 'Test description');
    console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
```

## Run

```bash
bun debug-test.ts
```

## Benefits

- Bypasses MCP transport layer
- Direct access to Result types and errors
- Can add breakpoints/logging
- Verifies core logic vs MCP wrapper issues

## Cleanup

Delete the test file after debugging:
```bash
rm debug-test.ts
```