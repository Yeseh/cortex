# Debugging Memory Content Loss

## Symptoms

- Memory updates succeed (exit code 0, timestamps change)
- Tags/metadata update correctly
- Content disappears (file ends with `---` and no content section)

## Debugging Process

### 1. Add Logging at Serialization Layer

```typescript
// packages/storage-fs/src/memories.ts - serializeMemory()
console.error(`Content length: ${content.length}, First 50: ${content.substring(0, 50)}`);
console.error(`Serialized string:`, JSON.stringify(fullString));
```

### 2. Add Logging at Storage Layer

```typescript
// packages/storage-fs/src/memory-storage.ts - write()
console.error(`Memory object content:`, memory.content?.substring(0, 50));
console.error(`Serialized full:`, JSON.stringify(serialized.value));
```

### 3. Add Logging at File Write Layer

```typescript
// packages/storage-fs/src/memories.ts - writeMemory()
console.error(`About to write to ${filePath}`);
console.error(`Content length: ${memory.length} chars`);
// After write
const verification = await readFile(filePath, 'utf8');
console.error(`Verification read - length: ${verification.length} chars`);
```

### 4. Add Logging at CLI Layer

```typescript
// packages/cli/src/commands/memory/update.ts
console.error(`options.content:`, options.content);
console.error(`contentResult.value:`, contentResult.value);
console.error(`Updates object:`, JSON.stringify(updates));
```

### 5. Check Test Output

```typescript
// In test
console.log('[DEBUG] CLI result:', {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
});
```

## Key Discovery Pattern

When you see:

```
[DEBUG] Updates: {"content":"","tags":["new-tag"]}  // ⚠️ Empty string, not undefined!
[DEBUG] Existing content length: 17
[DEBUG] Content being used:  Length: 0  // ⚠️ Lost here!
```

This indicates the `??` operator is choosing empty string over existing content:

```typescript
updates.content ?? existing.content;
// "" ?? "existing" → "" (wrong!)
// undefined ?? "existing" → "existing" (correct!)
```

## Common Root Causes

1. **Stdin reading when not requested** - check `requireStdinFlag` settings
2. **Empty string vs null/undefined** - check all content resolution paths
3. **Double serialization** - check for parse/serialize cycles
4. **Async race conditions** - check write ordering with verification reads

## Prevention

- Use strict equality checks: `content !== null && content !== undefined`
- Or use explicit undefined: `content === undefined ? existing : content`
- Add integration tests for partial updates (tags-only, expiration-only, etc.)
