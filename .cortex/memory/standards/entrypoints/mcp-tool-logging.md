---
created_at: 2026-03-01T12:42:42.925Z
updated_at: 2026-03-01T12:42:42.925Z
tags: 
  - standard
  - mcp
  - logging
  - observability
source: stdin
---
# MCP Tool Logging Convention

## Rule
All MCP tool handlers MUST add structured logging using `ctx.logger` optional chaining.

## Log Level Strategy
- `debug`: tool invoked, tool succeeded, client-correctable failures (InvalidParams path)
- `error`: storage/infrastructure failures (InternalError path)

## Log Call Placement
All log calls MUST be placed INSIDE the `withSpan(...)` callback, not outside.

## Log Message Format
`'<tool_name> invoked|succeeded|failed'`

## Metadata Keys
Use snake_case keys only: `store`, `path`, `error_code`, `count`, `dry_run`, `from_path`, `to_path`, `warning_count`

## Content Safety
Never log memory content (`input.content`, `result.value.content`) — only structural metadata.

## Error Signature
`ctx.logger?.error(msg, err?, meta?)` — when no Error object available, pass `undefined` as second arg.

## Testing
Use a `createSpyLogger()` factory with `mock()` from `bun:test` injected via `createMockCortexContext({ logger })`.
