---
created_at: 2026-02-28T00:17:54.356Z
updated_at: 2026-02-28T00:17:54.356Z
tags: 
  - zod
  - config
  - env-vars
  - gotcha
source: flag
---
Never use z.coerce.boolean() for boolean environment variables in Zod schemas. Boolean('false') === true in JS, so CORTEX_OTEL_ENABLED=false would silently enable the feature. Use explicit string transform instead: z.string().optional().transform(v => v === 'true' || v === '1').default(false). Only lowercase 'true' and '1' are truthy; uppercase 'TRUE' evaluates to false.