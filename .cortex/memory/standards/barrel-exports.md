---
{created_at: 2026-02-17T19:13:58.976Z,updated_at: 2026-02-17T19:13:58.976Z,tags: [standard,typescript,exports,modules],source: mcp}
---
# Barrel Exports Standard

## Rule
Each module exposes a selective public API via index.ts with explicit exports for types and values. Avoid wildcard exports.

## Guidelines
- Export types with `export type {}`
- Export values with `export {}`
- Group types first, then values/constants
- Rename port interfaces with `as` when helpful for clarity

## Package Exports
Package exports should provide subpath access (e.g., `./memory`, `./category`) mapping to module index.ts files in package.json exports.

## Example
```typescript
// index.ts
export type { MemoryMetadata, MemoryError } from './types';
export { createMemory, getMemory } from './operations';
```