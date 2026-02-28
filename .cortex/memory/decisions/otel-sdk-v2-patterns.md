---
created_at: 2026-02-28T00:17:55.706Z
updated_at: 2026-02-28T00:17:55.706Z
tags: 
  - opentelemetry
  - mcp
  - server
  - observability
source: flag
---
OTel SDK v2 (used in packages/server) has different APIs from v1: (1) use resourceFromAttributes() instead of new Resource(); (2) processors go in constructor config: new NodeTracerProvider({ spanProcessors: [...] }) and new LoggerProvider({ processors: [...] }) — NOT .addSpanProcessor()/.addLogRecordProcessor(). Module-level singleton guard (bootstrapped flag) prevents double-registration across test runs. Call shutdown() on both TracerProvider and LoggerProvider on server close to flush buffered spans/logs.