---
'@yeseh/cortex-server': patch
---

Fix MCP server rejecting reconnections with "Server already initialized"

The `WebStandardStreamableHTTPServerTransport` was configured with a session ID generator, making it stateful. Once a client initialized the transport, any subsequent `initialize` request (e.g. from a new OpenCode session after restart) was rejected with a 400 "Server already initialized" error because the session ID was not persisted across client restarts.

Switching to stateless mode (`sessionIdGenerator: undefined`) disables session tracking so clients can reinitialize on every connection without needing to persist an `mcp-session-id` between sessions.
