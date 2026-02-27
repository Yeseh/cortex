# Memory Loading Strategy

**Do NOT load all memories at once.** Use a progressive discovery approach:

## Step 1: List Category Structure

```
cortex_list_memories()
→ Returns top-level categories with memory counts
```

## Step 2: Drill Into Relevant Categories

```
cortex_list_memories(store: "{project}", category: "architecture")
→ See subcategories (cortex, other-project, etc.) with counts

cortex_list_memories(store: "{project}", category: "architecture/patterns")
→ See memories with token_estimate and descriptions
```

## Step 3: Load Specific Memories

```
cortex_get_memory(store: "{project}", path: "architecture/patterns/singleton")
→ Get the actual content
```

## Decision Criteria

Use these signals to decide what to load:

| Signal           | How to Use                                                 |
| ---------------- | ---------------------------------------------------------- |
| `token_estimate` | Skip large memories (<250 tokens) unless directly relevant               |
| `description`    | Category descriptions tell you what's inside               |
| `path`           | Well-named paths indicate content (e.g., `testing/policy`) |
