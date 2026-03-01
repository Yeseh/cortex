# @yeseh/cortex-server

## 0.6.0

### Patch Changes

- f2b5aa5: Add structured logging to all MCP tool handlers. Emits `debug` logs on invocation and client-correctable failures; `error` logs for infrastructure failures. Memory content is never logged — only structural metadata such as `store`, `path`, `error_code`, `count`, and `warning_count`.
    - @yeseh/cortex-core@0.6.0
    - @yeseh/cortex-storage-fs@0.6.0

## 0.5.1

### Patch Changes

- 53e027f: Fix MCP server rejecting reconnections with "Server already initialized"

    The `WebStandardStreamableHTTPServerTransport` was configured with a session ID generator, making it stateful. Once a client initialized the transport, any subsequent `initialize` request (e.g. from a new OpenCode session after restart) was rejected with a 400 "Server already initialized" error because the session ID was not persisted across client restarts.

    Switching to stateless mode (`sessionIdGenerator: undefined`) disables session tracking so clients can reinitialize on every connection without needing to persist an `mcp-session-id` between sessions.

- a579718: Change default store name to 'global'
    - @yeseh/cortex-core@0.5.1
    - @yeseh/cortex-storage-fs@0.5.1
