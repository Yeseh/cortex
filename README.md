<div align="center">
  <img src="assets/logo.svg" alt="Current Logo" width="200" />
  <p>
    <strong>
      A hierarchical memory system for AI coding agents 
    </strong>
  </p>
</div>

# About

> ⚠️ **Heads up:** this project is experimental and under active development. No guarantees it will work as expected.

Cortex gives AI coding agents persistent, structured memory across sessions. Agents read and write named memories organized into stores and categories — so context survives between conversations, projects, and machines.

## Packages

This is a monorepo containing the following packages:

| Package                                             | Description                              |
| --------------------------------------------------- | ---------------------------------------- |
| [`@yeseh/cortex-core`](./packages/core)             | Core domain logic, types, and validation |
| [`@yeseh/cortex-storage-fs`](./packages/storage-fs) | Filesystem storage adapter               |
| [`@yeseh/cortex-cli`](./packages/cli)               | Command-line interface                   |
| [`@yeseh/cortex-server`](./packages/server)         | MCP server for AI agent integration      |

## Install

Cortex packages are published to npm under the `@yeseh` scope.

### CLI (global)

```bash
npm install -g @yeseh/cortex-cli
```

### MCP server

```bash
npm install -g @yeseh/cortex-server
```

## Quickstart (CLI)

Use the CLI to initialize a store and create your first memory in under a minute.

```bash
# 1) Initialize global config + default store
cortex init

# 2) (Optional) Initialize a project-local store in the current repo
cortex store init

# 3) Add a memory
cortex memory add notes/first-memory -c "Cortex is set up"

# 4) List memories
cortex memory list

# 5) Read a memory
cortex memory show notes/first-memory
```

For command reference and advanced usage, see [CLI Guide](./docs/cli.md).

## Documentation

- [CLI Guide](./docs/cli.md)
- [MCP Server Guide](./docs/mcp-server.md)
- [Library Guide](./docs/library.md)
- [Configuration Reference](./docs/configuration.md)
- [Agent Instructions](./docs/agent-instructions.md)
- [Memory Lifecycle](./docs/memory-lifecycle.md)
- [Memory Organization](./docs/memory-organization.md)

## MCP Server

The MCP server exposes Cortex tools for agents over HTTP.

- `POST /mcp` — MCP protocol endpoint
- `GET /health` — health check

See [MCP Server Guide](./docs/mcp-server.md) for installation, startup, and client integration examples.

## Development

```bash
# Install dependencies
bun install

# Run all tests
bun test packages

# Run tests for a specific package
bun test packages/core
bun test packages/cli
bun test packages/server
bun test packages/storage-fs

# Type check
bun run typecheck

# Lint
bun run lint

# Build all packages
bun run build
```

### Project Structure

```
cortex/
├── packages/
│   ├── core/           # @yeseh/cortex-core
│   │   └── src/
│   │       ├── memory/     # Memory types and operations
│   │       ├── category/   # Category and index management
│   │       ├── store/      # Store registry
│   │       ├── storage/    # Storage port interfaces
│   │       └── config/     # Configuration parsing
│   ├── storage-fs/     # @yeseh/cortex-storage-fs
│   │   └── src/
│   │       └── ...         # Filesystem storage adapter
│   ├── cli/            # @yeseh/cortex-cli
│   │   └── src/
│   │       ├── commands/   # CLI commands
│   │       └── run.ts      # Entry point
│   └── server/         # @yeseh/cortex-server
│       └── src/
│           ├── memory/     # Memory MCP tools
│           ├── category/   # Category MCP tools
│           ├── store/      # Store MCP tools
│           └── index.ts    # MCP server entry
├── openspec/           # Specifications and change proposals
├── package.json        # Workspace root
└── tsconfig.base.json  # Shared TypeScript config
```

## License

MIT
