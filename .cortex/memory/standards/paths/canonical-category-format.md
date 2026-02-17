---
{created_at: 2026-02-17T20:44:52.308Z,updated_at: 2026-02-17T20:44:52.308Z,tags: [standard,paths,categories,fluent-api],source: mcp}
---
# Standard: Canonical Category Path Format

Category paths in the fluent client API use a canonical format with leading slash.

## Format
- **Root category**: `/`
- **Nested categories**: `/standards/javascript`
- **Always leading slash**, no trailing slash

## Normalization Rules
Input is normalized to canonical format:
1. Add leading `/` if missing
2. Strip trailing `/` (except root)
3. Collapse multiple slashes (`//` → `/`)

## Examples
```typescript
// All normalize to '/standards'
root.getCategory('standards');
root.getCategory('/standards');
root.getCategory('/standards/');

// Nested path
root.getCategory('standards/javascript').rawPath;  // '/standards/javascript'

// Root
store.rootCategory().rawPath;  // '/'
```

## Parent Navigation
```typescript
const js = root.getCategory('/standards/javascript');
js.parent().rawPath;         // '/standards'
js.parent().parent().rawPath; // '/'
js.parent().parent().parent(); // null
```

## Rationale
- Leading slash makes paths unambiguous (absolute vs relative)
- Consistent with filesystem conventions
- Clear distinction between root (`/`) and empty string