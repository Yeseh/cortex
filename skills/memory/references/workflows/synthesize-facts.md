# Synthesize Conversation Facts

**Use when:** conversation reveals durable user preferences, persona constraints, or project rules.

**Example trigger:** user says “Be concise and run tests before final handoff.”

```txt
# Human/persona in default store
cortex_add_memory(store: "default", path: "human/preferences/communication", content: "Prefers concise responses.", tags: ["communication"])

# Project behavior in project store
cortex_add_memory(store: "cortex", path: "standards/handoff", content: "Run relevant tests before final response.", tags: ["testing", "workflow"])
```
