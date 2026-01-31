# @yeseh/cortex-storage-fs

Filesystem storage adapter for Cortex. This package implements the storage ports defined in `@yeseh/cortex-core` using the local filesystem.

## Installation

```bash
bun add @yeseh/cortex-storage-fs
```

## Overview

This package provides:

- **FilesystemStorageAdapter** - Full storage adapter for memories, categories, and indexes
- **FilesystemStoreRegistry** - Multi-store registry with global configuration
- **Serialization utilities** - Parse and serialize memory files with YAML frontmatter

## Usage

### Basic Storage Operations

```typescript
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';

const adapter = new FilesystemStorageAdapter({
  rootDirectory: '/path/to/store'
});

// Read a memory
const result = await adapter.readMemory('project/notes/api-design');
if (result.ok && result.value) {
  console.log(result.value.content);
  console.log(result.value.metadata);
}

// Write a memory
await adapter.writeMemory('project/notes/new-note', {
  content: 'Memory content here',
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['architecture']
  }
});

// Delete a memory
await adapter.deleteMemory('project/notes/old-note');
```

### Store Registry

```typescript
import { FilesystemStoreRegistry } from '@yeseh/cortex-storage-fs';

const registry = new FilesystemStoreRegistry({
  globalConfigPath: '~/.config/cortex'
});

// List all registered stores
const stores = await registry.listStores();

// Get a specific store
const store = await registry.getStore('my-project');

// Register a new store
await registry.addStore('my-project', '/path/to/project/.cortex');

// Remove a store (doesn't delete files)
await registry.removeStore('my-project');
```

### Memory File Parsing

Memory files use YAML frontmatter for metadata:

```typescript
import { parseMemory, serializeMemory } from '@yeseh/cortex-storage-fs';

// Parse a memory file
const fileContent = `---
createdAt: 2024-01-15T10:00:00Z
updatedAt: 2024-01-15T10:00:00Z
tags:
  - architecture
  - backend
---
Use PostgreSQL for ACID compliance.
`;

const result = parseMemory(fileContent);
if (result.ok) {
  console.log(result.value.content);  // "Use PostgreSQL for ACID compliance."
  console.log(result.value.metadata.tags);  // ["architecture", "backend"]
}

// Serialize a memory to file format
const serialized = serializeMemory({
  content: 'New content',
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date()
  }
});
```

## File Structure

The filesystem adapter uses this directory structure:

```
store/
  _index.yaml           # Root category index
  category/
    _index.yaml         # Category index with memory summaries
    memory-slug.md      # Memory file with YAML frontmatter
    subcategory/
      _index.yaml
      another-memory.md
```

### Memory File Format

```markdown
---
createdAt: 2024-01-15T10:00:00.000Z
updatedAt: 2024-01-15T10:00:00.000Z
tags:
  - tag1
  - tag2
expiresAt: 2024-12-31T23:59:59.000Z  # optional
source: user  # optional
---

Memory content goes here. This can be any markdown content.
```

### Index File Format

```yaml
description: Optional category description
memories:
  - path: category/memory-slug
    tokenEstimate: 42
    summary: First line or generated summary
subcategories:
  - path: category/subcategory
    memoryCount: 5
    description: Subcategory description
```

## Related Packages

- `@yeseh/cortex-core` - Core types and domain logic
- `@yeseh/cortex-cli` - Command-line interface
- `@yeseh/cortex-server` - MCP server

## License

MIT
