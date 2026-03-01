# Library Guide

Core types and operations are available for embedding in your own tools.

The library API is low-level — this is the same layer used internally by the CLI and MCP server.

## Install

```bash
bun add @yeseh/cortex-core @yeseh/cortex-storage-fs
```

## Minimal Example

```typescript
import { join } from 'node:path';
import { Cortex } from '@yeseh/cortex-core';
import { FilesystemStorageAdapter, FilesystemConfigAdapter } from '@yeseh/cortex-storage-fs';

const cortex = Cortex.init({
    adapterFactory: (storeName) => {
        const storeRoot = join('.cortex', storeName);
        return new FilesystemStorageAdapter(
            new FilesystemConfigAdapter(join(storeRoot, '.config.yaml')),
            { rootDirectory: storeRoot }
        );
    },
});

const storeResult = cortex.getStore('my-store');
if (storeResult.ok()) {
    const memory = storeResult.value.getMemory('notes/example');
    const result = await memory.create({
        content: 'My content',
        source: 'user',
        tags: ['example'],
    });
    if (result.ok()) {
        console.log('Created:', result.value.path.toString());
    }
}
```

## Related

- [Configuration Reference](./configuration.md)
- [CLI Guide](./cli.md)
- [MCP Server Guide](./mcp-server.md)
