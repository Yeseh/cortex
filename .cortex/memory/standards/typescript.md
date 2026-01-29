---
created_at: 2026-01-29T19:53:54.872Z
updated_at: 2026-01-29T19:53:54.872Z
tags:
  - typescript
  - strict
  - eslint
  - configuration
source: mcp
---
Cortex uses TypeScript with strict configuration.

Key tsconfig settings:
- strict: true
- noUncheckedIndexedAccess: true
- noImplicitOverride: true
- noFallthroughCasesInSwitch: true
- verbatimModuleSyntax: true

ESLint enforces additional rules including @stylistic formatting.