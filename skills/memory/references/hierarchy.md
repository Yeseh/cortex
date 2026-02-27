# Category Hierarchy

Memories are organized into a hierarchical structure. Prefer using **nested categories** to keep things organized, and keeping categories meaningful.

Example structure:
```
memory/                           # Store (container)
├── human/                        # Global: User identity & preferences
│   ├── profile/
│   │   └── identity.md           # Who the user is
│   └── preferences/
│       ├── coding.md             # Coding style preferences
│       └── communication.md      # Communication preferences
├── persona/                      # Global: Agent behavior configuration
│   ├── tone.md                   # Communication tone
│   └── expertise.md              # Areas of focus
```

## Types of stores 

| Category   | Scope  | Purpose                                            |
| ---------- | ------ | -------------------------------------------------- |
| `default`  | Global | Special store that contains cross-project knowledge and preferences, user information and agent persona         | 
| `project`  | Local | Project-specific knowledge, the project name is used as the store name |

## Recommended 1-st level categories

| Category   | Store | Description                                        |
| ---------- | ------ | -------------------------------------------------- |
| `human`    | `default` | User identity, preferences, habits, agent persona                 |
| `persona`  | `default` | Agent behavior and personality                     |
| `standards` | `project` | Coding standards and guidelines  |
| `adr` | `project` | Architecture Decision Records          |

## Anti-Patterns to Avoid

```
# WRONG: Including store name in path
cortex_add_memory(path: "memory/global/human/profile")

# CORRECT: Path is just category/slug
cortex_add_memory(path: "human/profile/identity")

# CORRECT: Use project stores for project-specific items
cortex_add_memory(store: "{project}", path: "preferences")

# WRONG: Project memories in the default store in projects/
cortex_add_memory(store: "default", path: "projects/{project}/architecture")

# CORRECT: Nest under project name
cortex_add_memory(store: "{project}", path: "architecture/patterns")
```
