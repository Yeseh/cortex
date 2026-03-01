# CLI Guide

Use the Cortex CLI for manual memory management, scripting, and local store administration.

## Install

```bash
npm install -g @yeseh/cortex-cli
```

If `cortex` is not found, ensure your npm global bin directory is on your `PATH`.

## Quickstart

```bash
# Initialize global configuration (~/.config/cortex)
cortex init

# Optional: initialize a project-local store in the current repo
cortex store init

# Add a memory
cortex memory add notes/first-memory -c "Cortex is set up"

# List memories
cortex memory list

# Show a memory
cortex memory show notes/first-memory
```

## Memory Commands

```bash
cortex memory add <path> -c "content"    # Create a memory
cortex memory show <path>                 # Display a memory
cortex memory update <path> -c "new"     # Update a memory
cortex memory remove <path>               # Delete a memory
cortex memory move <from> <to>            # Move/rename a memory
cortex memory list [category]             # List memories
```

## Store Commands

```bash
cortex store list                         # List registered stores
cortex store add <name> <path>            # Register a store
cortex store remove <name>                # Unregister a store
cortex store init [path]                  # Initialize a new store
cortex store prune                        # Remove expired memories
cortex store reindex                      # Rebuild indexes
```

## Store Resolution

Cortex resolves which store to use in this order:

1. **Explicit**: `--store <name>` flag
2. **Local**: `.cortex/memory` in current directory
3. **Global**: `~/.config/cortex/memory`

## Related

- [Configuration Reference](./configuration.md)
- [Agent Instructions](./agent-instructions.md)
