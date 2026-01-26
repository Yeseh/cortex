---
created_at: 2026-01-26T20:52:25.673Z
updated_at: 2026-01-26T20:52:25.673Z
tags: [cli, patterns, standards, commander]
source: flag
---
# CLI Command Architecture Pattern

## File Organization
Commands organized in directories:
- command.ts - Main implementation (types can live here for simple commands)
- types.ts - Separate type definitions (for complex commands)
- *.spec.ts - Unit tests for business logic

## Layer Responsibilities

### Entrypoint (index.ts)
- Define commander options with custom parsers
- Parse raw CLI input to well-typed options object
- Wire up thin action handler
- KEEP AS THIN AS POSSIBLE

### Command Implementation (command.ts)
1. Custom Parsers - Used by commander, throw InvalidArgumentError (OK)
2. run() - Pure business logic, returns Result<Output, Error>, NEVER throws
3. Thin wrapper - Converts Result to CommanderError

## Type Patterns
- Use type over interface when union types might be needed
- Type alias for Results: type CommandResult = Result<Output, Error>
- Error codes: SCREAMING_SNAKE_CASE, exit code 1 default

## Testability
- Inject now?: Date for time-dependent logic
- Unit test run() directly (not through CLI)
- Integration tests call CLI like a user would