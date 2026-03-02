# @yeseh/cortex-server

## 0.6.10

### Patch Changes

- ac54168: Release version
- Updated dependencies [ac54168]
    - @yeseh/cortex-core@0.6.10
    - @yeseh/cortex-storage-fs@0.6.10

## 0.6.9

### Patch Changes

- e5d6868: Build of shame
- 3c52349: Another build of shame
- Updated dependencies [e5d6868]
- Updated dependencies [3c52349]
    - @yeseh/cortex-core@0.6.9
    - @yeseh/cortex-storage-fs@0.6.9

## 0.6.8

### Patch Changes

- 39a58e9: New version for publishing
- Updated dependencies [39a58e9]
    - @yeseh/cortex-core@0.6.8
    - @yeseh/cortex-storage-fs@0.6.8

## 0.6.7

### Patch Changes

- 7ca2ea7: Use bun to bundle the application
- Updated dependencies [7ca2ea7]
    - @yeseh/cortex-storage-fs@0.6.7
    - @yeseh/cortex-core@0.6.7

## 0.6.4

### Patch Changes

- @yeseh/cortex-core@0.6.4
- @yeseh/cortex-storage-fs@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [18dd91b]
- Updated dependencies [b93b0a3]
- Updated dependencies [4e128cc]
    - @yeseh/cortex-core@0.6.3
    - @yeseh/cortex-storage-fs@0.6.3

## 0.6.2

### Patch Changes

- @yeseh/cortex-core@0.6.2
- @yeseh/cortex-storage-fs@0.6.2

## 0.6.1

### Patch Changes

- @yeseh/cortex-core@0.6.1
- @yeseh/cortex-storage-fs@0.6.1

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
