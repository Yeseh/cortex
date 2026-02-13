# @yeseh/cortex-storage-fs

Filesystem storage adapter for Cortex. This package implements the storage ports defined in `@yeseh/cortex-core` using the local filesystem.

## Installation

```bash
bun add @yeseh/cortex-storage-fs
```

## Overview

This package provides:

- **FilesystemStorageAdapter** - Full storage adapter for memories, categories, and indexes
- **FilesystemRegistry** - Store registry with global configuration
- **Serialization utilities** - Parse and serialize memory files with YAML frontmatter

## Usage

### Basic Storage Operations

```typescript
import { FilesystemStorageAdapter } from '@yeseh/cortex-storage-fs';

const adapter = new FilesystemStorageAdapter({
  rootDirectory: '/path/to/store'
});

// Read a memory
const result = await adapter.memories.read('project/notes/api-design');
if (result.ok && result.value) {
  console.log(result.value.content);
  console.log(result.value.metadata);
}

// Write a memory
await adapter.memories.write('project/notes/new-note', 'Memory content here');

// Delete a memory
await adapter.memories.remove('project/notes/old-note');
```

### Store Registry

```typescript
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';

const registry = new FilesystemRegistry('/path/to/stores.yaml');

await registry.initialize();
await registry.load();

// Get a specific store
const store = registry.getStore('my-project');
```

### Memory File Parsing

Memory files use YAML frontmatter for metadata:

```typescript
import { parseMemory, serializeMemory } from '@yeseh/cortex-storage-fs';

// Parse a memory file
const fileContent = `---
created_at: 2024-01-15T10:00:00Z
updated_at: 2024-01-15T10:00:00Z
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
  index.yaml            # Root category index
  category/
    index.yaml          # Category index with memory summaries
    memory-slug.md      # Memory file with YAML frontmatter
    subcategory/
      index.yaml
      another-memory.md
```

### Memory File Format

```markdown
---
created_at: 2024-01-15T10:00:00.000Z
updated_at: 2024-01-15T10:00:00.000Z
tags:
  - tag1
  - tag2
expires_at: 2024-12-31T23:59:59.000Z  # optional
source: user  # optional
---

Memory content goes here. This can be any markdown content.
```

### Index File Format

```yaml
memories:
  - path: category/memory-slug
    token_estimate: 42
    summary: First line or generated summary
    updated_at: 2024-01-15T10:00:00.000Z # optional
subcategories:
  - path: category/subcategory
    memory_count: 5
    description: Subcategory description
```

## Related Packages

- `@yeseh/cortex-core` - Core types and domain logic
- `@yeseh/cortex-cli` - Command-line interface
- `@yeseh/cortex-server` - MCP server

## License

MIT
