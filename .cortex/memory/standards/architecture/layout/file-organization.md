---
created_at: 2026-01-27T20:54:34.870Z
updated_at: 2026-01-27T20:54:34.870Z
tags: [standards, file-organization, maintainability]
source: mcp
---
Guideline: Keep files focused and reasonably sized

Context: Large files that mix multiple concerns become hard to read and understand. The 926-line output.ts was problematic because it combined:
- Multiple serialization formats (YAML, JSON, TOON) in one file
- Type-specific logic duplicated across formats
- Validation mixed with serialization

Preferred approach:
- Each file should have a single, clear responsibility
- Split large files when they grow beyond ~200-300 lines or mix distinct concerns
- Prefer composition over monolithic implementations
- When logic naturally groups (e.g., "serialization"), still separate by format/variant if implementations are independent

Signs a file needs splitting:
- Multiple unrelated helper functions
- Switch statements dispatching to many type-specific implementations
- Difficulty understanding the file's purpose from a quick scan

Tags: standards, file-organization, maintainability