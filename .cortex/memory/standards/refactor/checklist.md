---
created_at: 2026-02-14T13:49:45.085Z
updated_at: 2026-02-14T13:49:45.085Z
tags:
  - refactor
  - checklist
  - pattern
  - quick-reference
source: mcp
expires_at: 2026-02-16T14:00:00.000Z
citations:
  - packages/core/src/memory/memory.ts
  - packages/core/src/memory/memory-path.ts
  - packages/core/src/memory/result.ts
  - packages/core/src/memory/operations/create.ts
  - packages/core/src/result.ts
---
# Refactoring Checklist - Core Library Style

Quick reference for refactoring modules to match the memory module style.

## Per-Module Setup

- [ ] Create `result.ts` with module-specific error type, codes, and factory
- [ ] Create domain class with private constructor + static factory returning Result
- [ ] Create path class if module has path-like identifiers
- [ ] Split operations into dedicated files in `operations/` subdirectory
- [ ] Create `test-helpers.spec.ts` with mock factory

## Domain Class Checklist

- [ ] Private constructor
- [ ] ES private fields (`#field`, not `private field`)
- [ ] Static factory method returns `Result<Class, Error>`
- [ ] All validation in factory method
- [ ] No setters, immutable design
- [ ] `toString()` or appropriate accessors

## Result Type Checklist

- [ ] Import `ok`, `err` from `@/result.ts`
- [ ] Use `result.ok()` method, NOT `result.ok` property
- [ ] Create module error factory: `moduleError(code, message, extras)`
- [ ] Error factory returns `Result<never, Error>` directly
- [ ] Wrap underlying errors in `cause` field

## Operation Checklist

- [ ] Remove serializer parameter (storage handles it)
- [ ] Use domain path class (e.g., `MemoryPath.fromPath()`)
- [ ] Return module Result type alias
- [ ] Include JSDoc with `@module`, `@param`, `@returns`, `@example`
- [ ] Colocated `.spec.ts` file

## Storage Interface Checklist

- [ ] Read returns domain object, not string
- [ ] Write accepts domain object, not string
- [ ] Path parameters use domain path class, not string