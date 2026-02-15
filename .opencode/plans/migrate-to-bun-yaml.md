# Plan: Migrate YAML Parsing to Bun Native Implementation

## Summary

Migrate from the `yaml` npm package (v2.8.2) to Bun's built-in `Bun.YAML` API for parsing and stringifying YAML content. This reduces dependencies and aligns with Bun-native development.

## Current State

### Dependency Locations
- Root `package.json`: `"yaml": "^2.8.2"`
- `packages/storage-fs/package.json`: `"yaml": "^2.8.2"`
- `packages/core/package.json`: `"yaml": "^2.8.2"` (dev dependency)

### Usage Sites (3 files)

| File | Import | API Used | Purpose |
|------|--------|----------|---------|
| `packages/storage-fs/src/memories.ts:24` | `import * as yaml from 'yaml'` | `yaml.parseDocument()`, `yaml.stringify()` | Memory frontmatter parsing/serialization |
| `packages/storage-fs/src/index-serialization.ts:10` | `import YAML from 'yaml'` | `YAML.parse()`, `YAML.stringify()` | Category index serialization |
| `packages/core/src/serialization.ts:10` | `import YAML from 'yaml'` | `YAML.parse()`, `YAML.stringify()` | Generic serialization |

### Not Affected
- `packages/core/src/store/registry.ts` - Uses **custom hand-rolled YAML parser** (no npm dependency)

## API Mapping

| npm `yaml` | Bun Native | Notes |
|------------|------------|-------|
| `YAML.parse(str)` | `Bun.YAML.parse(str)` | ✅ Direct replacement |
| `YAML.stringify(obj)` | `Bun.YAML.stringify(obj)` | ✅ Direct replacement (minor formatting differences possible) |
| `yaml.parseDocument(str, { uniqueKeys: true })` | ❌ Not available | **Breaking change** - see below |

## Breaking Change: Duplicate Key Detection

### Current Behavior (npm yaml)
The `memories.ts:153-166` uses `parseDocument()` with `{ uniqueKeys: true }` to detect duplicate frontmatter keys:

```typescript
const doc = yaml.parseDocument(frontmatterText, { uniqueKeys: true });
const hasDuplicateKeyIssue = [...doc.errors, ...doc.warnings]
    .some((issue) => /duplicate key/i.test(issue.message));

if (hasDuplicateKeyIssue) {
    return err({
        code: 'INVALID_FRONTMATTER',
        message: 'Duplicate frontmatter key.',
    });
}
```

### New Behavior (Bun YAML)
Bun's `YAML.parse()` does **not** provide duplicate key detection. When duplicate keys exist, the last value silently wins.

### Test Affected
- `packages/storage-fs/src/memories.spec.ts:192-210` - `it('should reject duplicate frontmatter keys', ...)` - **must be removed or updated**

### Decision
**Accepted**: Remove duplicate key validation. Duplicate keys in memory frontmatter will silently use the last value instead of being rejected.

## Implementation Tasks

### 1. Update `packages/storage-fs/src/memories.ts`

**Before:**
```typescript
import * as yaml from 'yaml';
// ...
const doc = yaml.parseDocument(frontmatterText, { uniqueKeys: true });
const hasDuplicateKeyIssue = [...doc.errors, ...doc.warnings]
    .some((issue) => /duplicate key/i.test(issue.message));
// ...
const frontmatterBody = yaml.stringify(frontmatterData).trimEnd();
```

**After:**
```typescript
import { YAML } from 'bun';
// ...
let data: unknown;
try {
    data = YAML.parse(frontmatterText);
} catch {
    return err({ code: 'INVALID_FRONTMATTER', message: 'Invalid YAML frontmatter.' });
}
// Remove duplicate key detection entirely
// ...
const frontmatterBody = YAML.stringify(frontmatterData).trimEnd();
```

### 2. Update `packages/storage-fs/src/index-serialization.ts`

**Before:**
```typescript
import YAML from 'yaml';
// ...
parsedYaml = YAML.parse(raw) as unknown;
// ...
return ok(YAML.stringify(yamlData));
```

**After:**
```typescript
import { YAML } from 'bun';
// ...
parsedYaml = YAML.parse(raw) as unknown;
// ...
return ok(YAML.stringify(yamlData));
```

### 3. Update `packages/core/src/serialization.ts`

**Before:**
```typescript
import YAML from 'yaml';
// ...
return ok(YAML.stringify(obj));
// ...
return ok(YAML.parse(raw) as T);
```

**After:**
```typescript
import { YAML } from 'bun';
// ...
return ok(YAML.stringify(obj));
// ...
return ok(YAML.parse(raw) as T);
```

### 4. Update Test: `packages/storage-fs/src/memories.spec.ts`

**Remove or update test:**
```typescript
it('should reject duplicate frontmatter keys', () => { ... });
```

**Option A - Remove entirely:**
Delete the test case as the behavior is no longer supported.

**Option B - Update to document new behavior:**
```typescript
it('should use last value when duplicate frontmatter keys exist', () => {
    const raw = [
        '---',
        'created_at: 2024-01-01T00:00:00.000Z',
        'updated_at: 2024-01-02T00:00:00.000Z',
        'tags: [personal]',
        'source: user',
        'source: duplicate', // Second value wins
        '---',
        'Duplicate keys use last value.',
    ].join('\n');

    const result = parseMemory(raw);

    expect(result.ok()).toBe(true);
    if (result.ok()) {
        expect(result.value.metadata.source).toBe('duplicate');
    }
});
```

### 5. Remove `yaml` Dependency

Update `package.json` files:

**Root `package.json`:**
Remove `"yaml": "^2.8.2"` from dependencies.

**`packages/storage-fs/package.json`:**
Remove `"yaml": "^2.8.2"` from dependencies.

**`packages/core/package.json`:**
Remove `"yaml": "^2.8.2"` from devDependencies.

### 6. Run `bun install` to update lockfile

### 7. Run Tests

```bash
bun test packages
```

Verify all tests pass (724+ tests).

## Potential Risks

### 1. YAML Output Formatting Differences
Bun's `YAML.stringify()` may produce slightly different formatting (whitespace, quoting) than npm `yaml`. The tests use `.toContain()` assertions which should tolerate this.

**Mitigation:** Run tests and visually inspect sample output. Snapshot tests may need updates.

### 2. Bun YAML Conformance (~90%)
Per Bun documentation, their YAML parser passes ~90% of the official YAML test suite. Edge cases may behave differently.

**Mitigation:** The project uses simple YAML structures (key-value maps, arrays, strings, dates). Complex YAML features (anchors, custom tags) are not used in memory frontmatter.

### 3. Error Message Differences
Parse errors from `Bun.YAML.parse()` throw `SyntaxError` with potentially different messages than npm `yaml`.

**Mitigation:** Error handling wraps errors generically. Test error cases to ensure they still fail appropriately.

## Verification Checklist

- [ ] All 3 files updated with `import { YAML } from 'bun'`
- [ ] `parseDocument()` usage removed from `memories.ts`
- [ ] Duplicate key detection logic removed
- [ ] Duplicate key test removed or updated
- [ ] `yaml` package removed from all `package.json` files
- [ ] `bun install` executed
- [ ] All tests pass (`bun test packages`)
- [ ] Build succeeds (`bun run build`)
- [ ] Manual verification: Create and read a memory with frontmatter
- [ ] Manual verification: List stores and memories

## Rollback Plan

If issues are discovered after deployment:
1. Revert changes via git
2. Restore `yaml` dependency: `bun add yaml@2.8.2`
3. Re-run tests

## Dependency Impact

**Before:**
- `yaml@2.8.2` (~300KB unpacked)

**After:**
- No external YAML dependency (Bun built-in)

## Related

- Bun YAML documentation: https://bun.sh/docs/runtime/yaml
- Prior migration: Express → Bun.serve (see `cortex:decisions/mcp-server-express-to-bun`)
