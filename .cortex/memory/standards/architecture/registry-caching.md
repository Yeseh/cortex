---
created_at: 2026-01-29T19:54:03.488Z
updated_at: 2026-01-29T19:54:03.488Z
tags:
  - standard
  - architecture
  - registry
  - caching
  - patterns
source: mcp
---
# Registry Caches Loaded Data Internally

## Standard
The `Registry` implementation caches loaded registry data internally after `load()` is called. This enables `getStore()` to be synchronous.

## Pattern
```typescript
class FilesystemRegistry implements Registry {
    private cache: StoreRegistry | null = null;
    
    async load(): Promise<Result<StoreRegistry, RegistryError>> {
        // Load from filesystem
        const data = await this.readFromDisk();
        if (data.ok) {
            this.cache = data.value;  // Cache internally
        }
        return data;
    }
    
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError> {
        // Uses cached data - synchronous
        if (!this.cache) {
            return err({ code: 'REGISTRY_NOT_LOADED', ... });
        }
        const storeDef = this.cache[name];
        if (!storeDef) {
            return err({ code: 'STORE_NOT_FOUND', ... });
        }
        return ok(new FilesystemStorageAdapter(storeDef.path));
    }
}
```

## Rationale
- Cleaner API (registry manages its own state)
- `getStore()` can be synchronous (adapter is just an entry point)
- Avoids passing registry data around

## Usage
```typescript
const registry = new FilesystemRegistry(path);
await registry.load();  // Load and cache
const adapter = registry.getStore('my-project');  // Sync, uses cache
```

## Related
- `.context/registry-brainstorm.md` - Full brainstorming session