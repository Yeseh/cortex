---
"@yeseh/cortex-server": patch
---

Add structured logging to all MCP tool handlers. Emits `debug` logs on invocation and client-correctable failures; `error` logs for infrastructure failures. Memory content is never logged — only structural metadata such as `store`, `path`, `error_code`, `count`, and `warning_count`.
