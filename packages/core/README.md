# @yeseh/cortex-core

Core domain logic for the Cortex memory system. This package provides types, validation, and business logic for memories, categories, stores, and indexing.

## Installation

```bash
bun add @yeseh/cortex-core
```

## Overview

This package is the foundation of Cortex, containing:

- **Memory types and operations** - Create, validate, and manipulate memories
- **Category management** - Hierarchical organization of memories
- **Store abstractions** - Registry and resolution for multi-store setups
- **Index types** - Category indexes with memory metadata and summaries
- **Tokenization** - Token estimation for LLM context management
- **Serialization** - YAML/TOON serialization utilities

## Exports

The package provides multiple entry points for different domains:

```typescript
// Main entry - common types and utilities
import { 
  defaultTokenizer,
  parseIndex,
  serializeIndex,
  type Result,
  type CoreError 
} from '@yeseh/cortex-core';

// Memory domain
import { 
  type Memory,
  type MemoryMetadata,
  validateMemorySlugPath,
  validateMemoryContent,
  createMemory,
  updateMemory 
} from '@yeseh/cortex-core/memory';

// Category domain
import { 
  type Category,
  type CategoryStoragePort,
  createCategory,
  setDescription 
} from '@yeseh/cortex-core/category';

// Store domain
import { 
  type Store,
  type StoreRegistry,
  createStoreRegistry 
} from '@yeseh/cortex-core/store';

// Index domain
import { 
  type CategoryIndex,
  type MemoryIndexEntry 
} from '@yeseh/cortex-core/index';

// Storage port interfaces
import { 
  type StorageAdapter 
} from '@yeseh/cortex-core/storage';
```

## Key Concepts

### Result Type

All operations return a `Result<T, E>` type for explicit error handling:

```typescript
import { validateMemorySlugPath } from '@yeseh/cortex-core/memory';

const result = validateMemorySlugPath('project/notes/api-design');
if (result.ok) {
  console.log(result.value); // { category: 'project/notes', slug: 'api-design', slugPath: 'project/notes/api-design' }
} else {
  console.error(result.error); // { code: 'INVALID_PATH', message: '...' }
}
```

### Memory Structure

Memories consist of content and metadata:

```typescript
interface Memory {
  content: string;
  metadata: MemoryMetadata;
}

interface MemoryMetadata {
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  source?: string;
  expiresAt?: Date;
}
```

### Storage Ports

The core package defines storage port interfaces that adapters implement:

```typescript
interface MemoryStoragePort {
  readMemory(slugPath: string): Promise<Result<Memory | null, StorageError>>;
  writeMemory(slugPath: string, memory: Memory): Promise<Result<void, StorageError>>;
  deleteMemory(slugPath: string): Promise<Result<void, StorageError>>;
  moveMemory(from: string, to: string): Promise<Result<void, StorageError>>;
}
```

## Related Packages

- `@yeseh/cortex-storage-fs` - Filesystem storage adapter
- `@yeseh/cortex-cli` - Command-line interface
- `@yeseh/cortex-server` - MCP server for AI agent integration

## License

MIT
