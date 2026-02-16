# @yeseh/cortex-core

Core domain logic for the Cortex memory system. This package provides types, validation, and business logic for memories, categories, stores, and indexing.

## Installation

```bash
bun add @yeseh/cortex-core
```

## Overview

This package is the foundation of Cortex, containing:

- **Memory types and operations** - Create, validate, and manipulate memories
- **Category management** - Hierarchical organization with index metadata
- **Store abstractions** - Registry and resolution for multi-store setups
- **Tokenization** - Token estimation for LLM context management
- **Serialization** - YAML/TOON serialization utilities

## Exports

The package provides multiple entry points for different domains:

```typescript
// Main entry - common types and utilities
import { 
  defaultTokenizer,
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

// Category domain (includes index types)
import { 
  type Category,
  type CategoryMemoryEntry,
  type SubcategoryEntry,
  type CategoryStorage,
  createCategory,
  setDescription 
} from '@yeseh/cortex-core/category';

// Store domain
import { 
  type Registry,
  initializeStore,
  resolveStore
} from '@yeseh/cortex-core/store';

// Category domain also includes index types
// (Category is the combined view of memories and subcategories)
// See the category import above for Category, CategoryMemoryEntry, etc.

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

The core package defines focused storage port interfaces that adapters implement:

```typescript
interface MemoryStorage {
  read(slugPath: string): Promise<Result<string | null, StorageAdapterError>>;
  write(slugPath: string, contents: string): Promise<Result<void, StorageAdapterError>>;
  remove(slugPath: string): Promise<Result<void, StorageAdapterError>>;
  move(from: string, to: string): Promise<Result<void, StorageAdapterError>>;
}
```

## Related Packages

- `@yeseh/cortex-storage-fs` - Filesystem storage adapter
- `@yeseh/cortex-cli` - Command-line interface
- `@yeseh/cortex-server` - MCP server for AI agent integration

## License

MIT
