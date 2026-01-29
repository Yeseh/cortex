---
created_at: 2026-01-29T19:53:52.669Z
updated_at: 2026-01-29T19:53:52.669Z
tags:
  - bun
  - runtime
  - testing
  - building
source: mcp
---
Cortex uses Bun as the JavaScript/TypeScript runtime.

- Testing: `bun test` with `.spec.ts` and `.test.ts` files
- Building: `bun build --compile --minify --sourcemap --bytecode`
- Package management: `bun install --frozen-lockfile`
- No Node.js-specific APIs; uses Bun-native features