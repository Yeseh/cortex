# Migration Guide

## v2.0.0 - Cortex Root Client

This release introduces breaking changes to how stores are configured and accessed.

### Summary of Changes

- `FilesystemRegistry` class has been **removed**
- `stores.yaml` has been replaced by unified `config.yaml`
- New `Cortex` root client provides unified access to stores

### Migrating from stores.yaml to config.yaml

**Before (stores.yaml):**
```yaml
default:
  path: ~/.config/cortex/memory
project:
  path: ./project-memory
```

**After (config.yaml):**
```yaml
settings:
  outputFormat: yaml
  autoSummary: true
  strictLocal: false

stores:
  default:
    path: ~/.config/cortex/memory
  project:
    path: ./project-memory
```

### Migrating Code

**Before:**
```typescript
import { FilesystemRegistry } from '@yeseh/cortex-storage-fs';

const registry = new FilesystemRegistry('/path/to/stores.yaml');
await registry.load();
const adapter = registry.getStore('mystore');
```

**After:**
```typescript
import { Cortex } from '@yeseh/cortex-core';
import { createFilesystemAdapterFactory } from '@yeseh/cortex-storage-fs';

const cortex = await Cortex.fromConfig('~/.config/cortex', createFilesystemAdapterFactory());
if (cortex.ok()) {
    const adapter = cortex.value.getStore('mystore');
}
```

### CLI Context Migration

If you were using the CLI context functions:

**Removed functions:**
- `getDefaultRegistryPath()` 
- `loadRegistry()`
- `resolveStorePathFromRegistry()`

**Use instead:**
- `createCortexContext()` - creates a full CortexContext
- `ctx.cortex.registry` - access the store registry
- `ctx.cortex.getStore(name)` - get a store adapter

### Automatic Migration

Run `cortex init` to create a new `config.yaml` from your existing setup. The command will:
1. Detect existing `~/.config/cortex/memory` directory
2. Create `config.yaml` with default settings and store definitions
