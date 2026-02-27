# Brainstorm: Cortex Scoping and Multi-Project Memory Access

**Date**: 2025-01-25  
**Participants**: Jesse Wellenberg, Claude

## Problem Statement

The current Cortex architecture presents challenges when integrating with opencode:

1. **Docker volume issue**: Running the MCP server in Docker requires volume configuration, meaning memory storage is managed by Docker rather than at a user-specified location.
2. **Single store limitation**: Running the server directly only supports a single `CORTEX_DATA_PATH`, with no way to specify multiple stores (e.g., project-local and global).
3. **Project memory sharing**: Need a way to include project-specific memories in git for team sharing.

## Explored Approaches

### Multi-Store with Explicit Store Parameter (Rejected)

**Concept**: Pass multiple store configs to the server, each tool call includes a `store` parameter.

```bash
bunx @cortex/server --config ~/.config/cortex/stores.yaml --config ./.cortex/stores.yaml
```

**Why rejected**:

- Added complexity without clear benefit
- Server becomes less stateless
- Store configuration management becomes cumbersome
- Merging configs from multiple sources adds edge cases (conflicts, precedence)

### Project-Local Stores with Symlinks/Mounts (Shelved)

**Concept**: Project memories live in the repo (`.cortex/memory/`), server accesses them via symlinks or mount configuration.

**Options explored**:

- Symlinks from global store to project directories
- Mount/overlay configuration in a config file
- Project registration command (`cortex project register`)
- Server auto-discovery of project stores

**Why shelved**:

- Symlinks are fragile on Windows
- Mount configs need maintenance
- Starting server from project directory or passing overlays is cumbersome
- Too many constraints on workflow

## Agreed Design: Single Store with Category-Based Organization

### Core Concept

One server instance serves one store. Organization is achieved through **nested categories** rather than multiple stores.

### Directory Structure

```
~/.config/cortex/memory/
├── global/
│   ├── persona/
│   │   └── [memories]
│   └── human/
│       └── [memories]
└── projects/
    ├── cortex/
    │   ├── architecture/
    │   └── conventions/
    └── another-project/
        └── [memories]
```

### Key Decisions

| Decision              | Choice              | Rationale                                                   |
| --------------------- | ------------------- | ----------------------------------------------------------- |
| Store count           | Single store        | Simplicity, stateless server                                |
| Organization          | Nested categories   | Flexible, no code changes needed                            |
| Hierarchy enforcement | Convention only     | `global/` vs `projects/<name>/` is convention, not enforced |
| Path separator        | `/` (forward slash) | Unix-style, already implemented                             |
| Naming convention     | kebab-case          | Consistent with existing slug validation                    |
| Depth limit           | None                | Arbitrary nesting supported                                 |
| Path specification    | Full path always    | No implicit "current project" magic                         |
| Index location        | Each level          | Progressive disclosure, already implemented                 |

### Server Configuration

```bash
# Just works with defaults (uses CORTEX_DATA_PATH or default)
bunx @cortex/server

# Override if needed
CORTEX_DATA_PATH=/custom/path bunx @cortex/server
```

**Default data path**: Keep existing default (`./.cortex-data` for local, `/data` for Docker). User configures via environment variable.

### Memory Addressing

Full category path always passed explicitly:

```typescript
// Examples of memory paths
'global/persona/communication-style';
'global/human/preferences';
'projects/cortex/architecture/decisions';
'projects/cortex/conventions/error-handling';
```

### Project Isolation

- Isolation is convention-based, not enforced
- Acceptable for personal development use case
- Different projects are separated by category path (`projects/cortex/` vs `projects/other/`)

## Implementation Findings

**Good news**: The core model already supports this design!

### What Already Works

1. **Arbitrary category nesting** - `MemoryCategoryPath` is `string[]` with no depth limit
2. **Validation** - Only requires minimum one category segment, no maximum
3. **Filesystem adapter** - Handles nested paths correctly (recursive traversal, index building)
4. **CLI** - Tests prove deep nesting works (`a/b/c/d/deep-memory`)
5. **Indexes at each level** - Already implemented for progressive disclosure

### What Needs Updating

1. **Spec update** (`openspec/specs/memory-core/spec.md`):
    - Change "maximum of two category levels" to "one or more category levels"
    - Document that depth is unlimited

2. **Error code documentation** (`src/server/errors.ts`):
    - `INVALID_CATEGORY_DEPTH` comment says "exceeds maximum nesting depth"
    - Should say "does not meet minimum depth requirement" (at least one category)

3. **Convention documentation**:
    - Document `global/` vs `projects/<name>/` pattern
    - Make clear this is convention, not enforcement

## Deferred Items

### Git-Tracked Project Memories (Shelved)

The problem of sharing project-specific memories via git remains unsolved. Potential future approaches:

- Symlinks (Windows issues)
- Mount configuration
- Project registration
- Server overlay paths

**Decision**: Revisit when actual usage patterns are clearer.

### NPM Package Publishing (Deferred)

For `bunx @cortex/server` to work elegantly, package needs npm publishing.

**Decision**: Defer until core functionality is stable.

### Deployed/Shared Server (Out of Scope)

Use case where MCP server is deployed for team use with non-filesystem storage.

**Decision**: Future concern, requires different storage backend.

## Migration Path

Current opencode harness has:

- Local store: `<project>/.cortex/memory/`
- Global store: `~/.config/opencode/.cortex/memory/`

Migration to Cortex:

- Opencode harness will use Cortex as its backend
- Specific migration steps to be determined later
- Category structure: `global/persona`, `global/human`, `projects/<name>/...`

## Summary

The brainstorm concluded that the simplest viable solution is:

1. **Single store** at a configurable path (default works for most cases)
2. **Category-based organization** for project/global separation
3. **Full paths** always specified explicitly
4. **Convention over enforcement** for the `global/` vs `projects/` pattern

The implementation already supports this - only spec documentation needs updating.
