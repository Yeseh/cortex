# Merge Config Files Implementation Plan

**Goal:** Merge separate config.yaml and stores.yaml into a single config.yaml with `settings:` and `stores:` sections
**Architecture:** Extend existing config parsing to support nested sections (settings/stores), add CortexSettings type with defaults, add absolute path validation, add CORTEX_CONFIG_PATH env var support
**Tech Stack:** TypeScript, Bun.YAML, Result types
**Session Id:** merge-config-files-impl

---

## Dependencies

```
Task 1 (Schema) ─────┐
                     ├──> Task 3 (Config Parsing)
Task 2 (StoreDefinition extends) ┘           │
                                             ├──> Task 4 (Env Var Support)
                                             │            │
                                             ├──> Task 5 (FilesystemRegistry)
                                             │
                                             └──> Task 6 (Tests)
```

## Phase 1: Core Schema Updates

### Task 1.1: Define CortexSettings type

**File:** `packages/core/src/config.ts`
**Type:** Implementation

1. Write failing test for CortexSettings type validation

```typescript
// In config.spec.ts
describe('CortexSettings', () => {
    it('should have default values', () => {
        const defaults = getDefaultSettings();
        expect(defaults.output_format).toBe('yaml');
        expect(defaults.auto_summary).toBe(false);
        expect(defaults.strict_local).toBe(false);
    });
});
```

2. Define `OutputFormat` type to include 'toon':

```typescript
export type OutputFormat = 'yaml' | 'json' | 'toon';
```

3. Define `CortexSettings` interface with snake_case fields (matching YAML):

```typescript
export interface CortexSettings {
    output_format: OutputFormat;
    auto_summary: boolean;
    strict_local: boolean;
}
```

4. Create `getDefaultSettings()` function:

```typescript
export const getDefaultSettings = (): CortexSettings => ({
    output_format: 'yaml',
    auto_summary: false,
    strict_local: false,
});
```

5. Run test to verify

### Task 1.2: Define merged config structure

**File:** `packages/core/src/config.ts`
**Type:** Implementation

1. Import `StoreDefinition` and `StoreRegistry` from store module

2. Define `MergedConfig` interface:

```typescript
export interface MergedConfig {
    settings: CortexSettings;
    stores: StoreRegistry;
}
```

3. Define `ConfigFileContent` for raw parsed YAML:

```typescript
interface ConfigFileContent {
    settings?: Partial<CortexSettings>;
    stores?: Record<string, { path: string; description?: string }>;
}
```

### Task 1.3: Add absolute path validation

**File:** `packages/core/src/config.ts`
**Type:** Implementation

1. Write failing test:

```typescript
it('should reject relative store paths', () => {
    const result = validateStorePath('./relative/path');
    expect(result.ok()).toBe(false);
    if (!result.ok()) {
        expect(result.error.code).toBe('INVALID_STORE_PATH');
    }
});
```

2. Add validation error code:

```typescript
export type ConfigValidationErrorCode =
    | 'INVALID_STORE_PATH'
    | 'INVALID_SETTINGS_FIELD'
    | 'CONFIG_PARSE_FAILED';
```

3. Implement `validateStorePath()`:

```typescript
import { isAbsolute } from 'node:path';

export const validateStorePath = (
    path: string,
    storeName: string
): Result<void, ConfigValidationError> => {
    if (!isAbsolute(path)) {
        return err({
            code: 'INVALID_STORE_PATH',
            message: `Store '${storeName}' path must be absolute. Got: ${path}. Use an absolute path like '/home/user/.cortex/memory' or expand ~ before configuration.`,
            store: storeName,
        });
    }
    return ok(undefined);
};
```

4. Run test

## Phase 2: Config Parsing & Serialization

### Task 2.1: Implement parseMergedConfig()

**File:** `packages/core/src/config.ts`
**Type:** Implementation

1. Write failing test:

```typescript
describe('parseMergedConfig', () => {
    it('should parse config with settings and stores sections', () => {
        const raw = `
settings:
  output_format: json
  auto_summary: true
stores:
  default:
    path: /home/user/.config/cortex/memory
`;
        const result = parseMergedConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings.output_format).toBe('json');
            expect(result.value.settings.auto_summary).toBe(true);
            expect(result.value.stores.default.path).toBe('/home/user/.config/cortex/memory');
        }
    });
});
```

2. Implement using Bun.YAML:

```typescript
export const parseMergedConfig = (raw: string): Result<MergedConfig, ConfigLoadError> => {
    let parsed: ConfigFileContent;
    try {
        parsed = (Bun.YAML.parse(raw) as ConfigFileContent) ?? {};
    } catch (error) {
        return err({
            code: 'CONFIG_PARSE_FAILED',
            message: 'Invalid YAML syntax in config file.',
            cause: error,
        });
    }

    const defaults = getDefaultSettings();
    const settings: CortexSettings = {
        output_format: parsed.settings?.output_format ?? defaults.output_format,
        auto_summary: parsed.settings?.auto_summary ?? defaults.auto_summary,
        strict_local: parsed.settings?.strict_local ?? defaults.strict_local,
    };

    // Validate settings fields
    if (settings.output_format && !['yaml', 'json', 'toon'].includes(settings.output_format)) {
        return err({
            code: 'CONFIG_VALIDATION_FAILED',
            message: `Invalid output_format: ${settings.output_format}. Must be yaml, json, or toon.`,
            field: 'output_format',
        });
    }

    // Validate and transform stores
    const stores: StoreRegistry = {};
    if (parsed.stores) {
        for (const [name, def] of Object.entries(parsed.stores)) {
            const pathValidation = validateStorePath(def.path, name);
            if (!pathValidation.ok()) {
                return pathValidation;
            }
            stores[name] = {
                path: def.path,
                ...(def.description !== undefined && { description: def.description }),
            };
        }
    }

    return ok({ settings, stores });
};
```

3. Run test

### Task 2.2: Implement serializeMergedConfig()

**File:** `packages/core/src/config.ts`
**Type:** Implementation

1. Write failing test:

```typescript
it('should serialize merged config to YAML', () => {
    const config: MergedConfig = {
        settings: { output_format: 'json', auto_summary: false, strict_local: true },
        stores: { default: { path: '/data/default' } },
    };
    const result = serializeMergedConfig(config);
    expect(result.ok()).toBe(true);
    if (result.ok()) {
        expect(result.value).toContain('output_format: json');
        expect(result.value).toContain('path: "/data/default"');
    }
});
```

2. Implement:

```typescript
export const serializeMergedConfig = (config: MergedConfig): Result<string, ConfigLoadError> => {
    const lines: string[] = [];

    // Settings section
    lines.push('settings:');
    lines.push(`  output_format: ${config.settings.output_format}`);
    lines.push(`  auto_summary: ${config.settings.auto_summary}`);
    lines.push(`  strict_local: ${config.settings.strict_local}`);

    // Stores section (reuse existing serializeStoreRegistry logic pattern)
    if (Object.keys(config.stores).length > 0) {
        lines.push('stores:');
        const sortedStores = Object.entries(config.stores).sort(([a], [b]) => a.localeCompare(b));
        for (const [name, def] of sortedStores) {
            lines.push(`  ${name}:`);
            lines.push(`    path: ${JSON.stringify(def.path)}`);
            if (def.description !== undefined) {
                lines.push(`    description: ${JSON.stringify(def.description)}`);
            }
        }
    }

    return ok(lines.join('\n'));
};
```

3. Run test

## Phase 3: Environment Variable Support

### Task 3.1: Implement CORTEX_CONFIG_PATH env var

**File:** `packages/core/src/config.ts`
**Type:** Implementation

1. Write failing test:

```typescript
describe('getConfigPath', () => {
    it('should use CORTEX_CONFIG_PATH when set', () => {
        const original = process.env.CORTEX_CONFIG_PATH;
        process.env.CORTEX_CONFIG_PATH = '/custom/path';
        try {
            const result = getConfigPath();
            expect(result).toBe('/custom/path/config.yaml');
        } finally {
            if (original !== undefined) {
                process.env.CORTEX_CONFIG_PATH = original;
            } else {
                delete process.env.CORTEX_CONFIG_PATH;
            }
        }
    });
});
```

2. Implement tilde expansion helper:

```typescript
import { homedir } from 'node:os';

const expandTilde = (path: string): string => {
    if (path.startsWith('~/')) {
        return join(homedir(), path.slice(2));
    }
    if (path === '~') {
        return homedir();
    }
    return path;
};
```

3. Implement `getConfigPath()`:

```typescript
export const getConfigPath = (): string => {
    const envPath = process.env.CORTEX_CONFIG_PATH;
    if (envPath) {
        const expanded = expandTilde(envPath);
        return join(expanded, 'config.yaml');
    }
    return join(homedir(), '.config', 'cortex', 'config.yaml');
};
```

4. Run test

## Phase 4: FilesystemRegistry Updates

### Task 4.1: Update FilesystemRegistry to read merged format

**File:** `packages/storage-fs/src/filesystem-registry.ts`
**Type:** Implementation

1. Import the new parsing functions:

```typescript
import { parseMergedConfig, getConfigPath, type MergedConfig } from '@yeseh/cortex-core';
```

2. Update constructor to accept config path (not stores.yaml path):

```typescript
constructor(private readonly configPath: string = getConfigPath()) {}
```

3. Update `load()` to parse merged format:

```typescript
async load(): Promise<Result<StoreRegistry, RegistryError>> {
  let contents: string;
  try {
    contents = await readFile(this.configPath, 'utf8');
  } catch (error) {
    if (isNotFoundError(error)) {
      return err({
        code: 'REGISTRY_MISSING',
        message: `Config not found at ${this.configPath}`,
        path: this.configPath,
      });
    }
    return err({
      code: 'REGISTRY_READ_FAILED',
      message: `Failed to read config at ${this.configPath}`,
      path: this.configPath,
      cause: error,
    });
  }

  const parsed = parseMergedConfig(contents);
  if (!parsed.ok()) {
    return err({
      code: 'REGISTRY_PARSE_FAILED',
      message: `Failed to parse config at ${this.configPath}`,
      path: this.configPath,
      cause: parsed.error,
    });
  }

  this.cache = parsed.value.stores;
  return ok(parsed.value.stores);
}
```

4. Update `initialize()` to write merged format:

```typescript
async initialize(): Promise<Result<void, RegistryError>> {
  try {
    try {
      await readFile(this.configPath, 'utf8');
      return ok(undefined); // Already exists
    } catch (error) {
      if (!isNotFoundError(error)) {
        return err({
          code: 'REGISTRY_READ_FAILED',
          message: `Failed to check config at ${this.configPath}`,
          path: this.configPath,
          cause: error,
        });
      }
    }

    await mkdir(dirname(this.configPath), { recursive: true });
    const defaultConfig = `settings:\n  output_format: yaml\n  auto_summary: false\n  strict_local: false\nstores:\n`;
    await writeFile(this.configPath, defaultConfig, 'utf8');
    return ok(undefined);
  } catch (error) {
    return err({
      code: 'REGISTRY_WRITE_FAILED',
      message: `Failed to initialize config at ${this.configPath}`,
      path: this.configPath,
      cause: error,
    });
  }
}
```

5. Update `save()` to preserve settings when writing stores:
    - Need to read current config first to preserve settings
    - Then merge new stores and write back

### Task 4.2: Update FilesystemRegistry tests

**File:** `packages/storage-fs/src/filesystem-registry.spec.ts`
**Type:** Testing

1. Update test fixtures to use merged format:

```typescript
const registryContent = `
settings:
  output_format: yaml
  auto_summary: false
  strict_local: false
stores:
  default:
    path: ${tempDir}/default
  work:
    path: ${tempDir}/work
`;
```

2. Add test for config without stores section:

```typescript
it('should load config with only settings', async () => {
    const content = `
settings:
  output_format: json
`;
    await fs.writeFile(configPath, content);
    const registry = new FilesystemRegistry(configPath);
    const result = await registry.load();
    expect(result.ok()).toBe(true);
    if (result.ok()) {
        expect(Object.keys(result.value)).toHaveLength(0);
    }
});
```

3. Add test for absolute path validation:

```typescript
it('should reject relative store paths', async () => {
    const content = `
stores:
  invalid:
    path: ./relative/path
`;
    await fs.writeFile(configPath, content);
    const registry = new FilesystemRegistry(configPath);
    const result = await registry.load();
    expect(result.ok()).toBe(false);
    if (!result.ok()) {
        expect(result.error.code).toBe('REGISTRY_PARSE_FAILED');
    }
});
```

## Phase 5: Integration Tests

### Task 5.1: Write integration tests for merged config

**File:** `packages/core/src/config.spec.ts`
**Type:** Testing

1. Test round-trip (parse -> serialize -> parse):

```typescript
it('should round-trip merged config', () => {
    const original: MergedConfig = {
        settings: { output_format: 'json', auto_summary: true, strict_local: false },
        stores: {
            default: { path: '/home/user/.cortex', description: 'Default store' },
            project: { path: '/project/.cortex' },
        },
    };
    const serialized = serializeMergedConfig(original);
    expect(serialized.ok()).toBe(true);
    if (!serialized.ok()) return;

    const parsed = parseMergedConfig(serialized.value);
    expect(parsed.ok()).toBe(true);
    if (!parsed.ok()) return;

    expect(parsed.value.settings).toEqual(original.settings);
    expect(parsed.value.stores.default.path).toBe(original.stores.default.path);
});
```

2. Test defaults when sections are omitted:

```typescript
it('should use defaults for omitted settings', () => {
    const raw = `
stores:
  default:
    path: /data/default
`;
    const result = parseMergedConfig(raw);
    expect(result.ok()).toBe(true);
    if (result.ok()) {
        expect(result.value.settings.output_format).toBe('yaml');
        expect(result.value.settings.auto_summary).toBe(false);
        expect(result.value.settings.strict_local).toBe(false);
    }
});
```

## Validation

### Task 6.1: Run full validation suite

**Type:** Validation

```bash
# Run all tests
bun test packages

# Run linting
bunx eslint packages/*/src/**/*.ts --fix

# Run type checking
bunx tsc --build
```

## Exports Update

### Task 7.1: Update core package exports

**File:** `packages/core/src/index.ts`

Add exports:

```typescript
export {
    type CortexSettings,
    type MergedConfig,
    getDefaultSettings,
    parseMergedConfig,
    serializeMergedConfig,
    getConfigPath,
    validateStorePath,
} from './config.ts';
```

---

## Summary of Files to Modify

| File                                                  | Changes                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/config.ts`                         | Add CortexSettings, MergedConfig, parseMergedConfig, serializeMergedConfig, getConfigPath, validateStorePath |
| `packages/core/src/config.spec.ts`                    | Add tests for new functions                                                                                  |
| `packages/core/src/index.ts`                          | Export new types and functions                                                                               |
| `packages/storage-fs/src/filesystem-registry.ts`      | Update to read merged config format                                                                          |
| `packages/storage-fs/src/filesystem-registry.spec.ts` | Update tests for merged format                                                                               |

## Breaking Changes

- `FilesystemRegistry` constructor parameter changes from `stores.yaml` path to `config.yaml` path
- Store paths must now be absolute (relative paths rejected with `INVALID_STORE_PATH` error)
- Existing `stores.yaml` files need migration to `config.yaml` format
