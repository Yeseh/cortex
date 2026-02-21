---
{created_at: 2026-02-21T16:10:58.162Z,updated_at: 2026-02-21T16:10:58.162Z,tags: [feature-idea,memory-system,automation,configuration],source: mcp}
---
# Store-Specific Guardrails

Feature idea to enable automatic policies applied during memory creation based on the store configuration.

## Motivation

Different stores have different purposes and lifecycles. Allowing store-level policies ensures consistency and reduces manual configuration for each memory operation.

## Potential Guardrails

### Auto-Expiry Dates
- Configure default TTL per store
- Examples:
  - `investigations/` store: 14 days default
  - `standup/` category: 7 days default
  - `default` store: no expiry
- Override per-memory if needed

### Auto-Tags
- Apply tags automatically based on store or category
- Examples:
  - All memories in `cortex` store get `project:cortex` tag
  - All memories in `runbooks/` get `operational` tag
  - Category-based tagging: `decisions/*` → `decision` tag

### Other Potential Policies
- Default source attribution
- Required metadata fields
- Maximum content length
- Token budget limits per category
- Auto-citations for certain stores

## Implementation Considerations

- Store configuration file (`.cortex/config.yaml` or similar)
- Category-level overrides
- CLI flags to bypass guardrails when needed
- MCP tool parameters to specify overrides
- Validation at the core operation level

## Related

- Store management operations
- Memory creation workflows
- Category organization patterns