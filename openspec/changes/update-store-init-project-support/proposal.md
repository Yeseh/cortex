# Change: Enhance Store Init with Project Support

## Why

Currently, `cortex store init` creates a local store but doesn't auto-detect project context or register the store. Agents need project-scoped stores that are automatically named after the git repository and registered in the global store registry for discoverability.

## What Changes

- Auto-detect git repository name as store name (via `git rev-parse --show-toplevel`)
- Add `--name` flag to override auto-detected name
- Error if not in git repo and `--name` not specified
- Error if store name already exists in registry (name collision)
- Auto-register new store in global `stores.yaml` registry
- Create project entry memory in `default` store at `projects/{name}`

## Impact

- Affected specs: `cli-store`
- Affected code:
    - `src/cli/commands/store.ts` - git detection, name flag, registration logic
    - `src/core/store/registry.ts` - registry operations (already exists)
