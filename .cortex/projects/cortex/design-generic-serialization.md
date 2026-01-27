---
created_at: 2026-01-27T20:48:03.334Z
updated_at: 2026-01-27T20:48:03.334Z
tags: [design, serialization, output-format, generic-programming]
source: mcp
---
Design Principle: Generic Output Serialization

Context: The current output.ts file (926 lines) implements type-specific serialization with switch statements dispatching to per-type serializers for each format (YAML, JSON, TOON).

Preferred Approach:
1. Serialization should be completely generic: `serialize(obj, format)` works on any object
2. No type-specific dispatch (no switch on payload.kind)
3. Use standard libraries for serialization (e.g., js-yaml for YAML, JSON.stringify for JSON)
4. Serialization belongs in the core library, not CLI layer (it's essentially toString(format))

Implementation guidance:
- For JSON: JSON.stringify(obj)
- For YAML: Use js-yaml library (not custom formatting)
- For TOON: Use existing toonEncode function
- Custom formatting (comments, frontmatter) should be removed in favor of standard output

This pairs with the unified-domain-entities principle: if objects are guaranteed valid at construction, serialization can be trivial.

Tags: design, serialization, output-format, generic-programming