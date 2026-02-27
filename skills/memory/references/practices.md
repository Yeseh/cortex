# Best Practices

1. **Always specify store explicitly** - The `store` parameter is required on all operations
2. **Use nested categories** - Don't dump everything at the first level
3. **Add category descriptions** - Help future sessions discover what's stored
4. **Check token estimates** - Don't load large memories unless needed
5. **Be specific with paths** - `testing/unit-test-patterns` instead of `/test-stuff`
6. **Use tags consistently** - Tags aid filtering and discovery
7. **Set expiration on temporary knowledge** - Context, investigations, sprint notes should expire
8. **Prune regularly** - Run `cortex_prune_memories` to clean up expired items
9. **One concept per memory** - Keep memories small, atomic, and focused
10. **Update, don't duplicate** - Check if memory exists before creating new ones
11. **Clean up after sessions** - Set expiration on context memories you created

## Choosing the Right Store

When deciding which store to use, follow this decision tree:

1. **Is this user/human-specific information?**
   → Use `store: "default"` with `human/` category path

2. **Is this project-specific knowledge that should live with the codebase?**
   → Check if a project store exists (`cortex_list_stores()`)
   → If yes, use `store: "project-name"` (e.g., `store: "my-app"`)
   → If no, use `store: "default"` with `projects/{name}/` path

3. **Is this cross-project or general domain knowledge?**
   → Use `store: "default"` with `domain/` category path

4. **Is this persona/agent configuration?**
   → Use `store: "default"` with `persona/` category path

## Project Store vs Default Store

Use a **project store** (created via `cortex store init`) for:

- Architecture patterns and decisions that define the project
- Coding standards specific to this codebase
- Complex domain knowledge that agents need repeatedly
- Knowledge that should live with the repo (can be version controlled)

Use the **default store** `projects/{name}/` category for:

- Quick notes and temporary observations
- Cross-project references
- Knowledge about the project that's personal to you (not the team)

**Rule of thumb**: If the knowledge belongs in the repo's documentation, it probably belongs in a project store. If it's personal context about working on the project, use the default store.

## Setting Expiration
Expiration dates should always be set on temporary memories to keep the memory clean. Examples of temporary memories include:
- Current session context
- Investigations and experiments
- Sprint notes and to-dos
- Recent changes

See [expiration.md](expiration.md) for detailed expiration policies and patterns.
