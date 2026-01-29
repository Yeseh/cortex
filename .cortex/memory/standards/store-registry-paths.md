---
created_at: 2026-01-29T21:08:00.980Z
updated_at: 2026-01-29T21:08:00.980Z
tags:
  - registry
  - configuration
  - troubleshooting
source: flag
---
# Store Registry Path Format

## Rule
Store paths in the registry (`~/.config/cortex/stores.yaml`) must point to the actual memory root directory, not a parent directory.

## Correct
```yaml
stores:
  cortex:
    path: "F:\repo\cortex\.cortex\memory"  # Points to memory root
  default:
    path: "C:\Users\user\.config\cortex\memory"
```

## Incorrect
```yaml
stores:
  cortex:
    path: "F:\repo\cortex\.cortex"  # Missing /memory suffix
```

## Why This Matters
- The storage adapter expects root index.yaml at the store path
- Memory paths are relative to this root
- Incorrect paths cause `memory list` to return empty results
- Reindex will generate paths with wrong prefixes

## Diagnosis
If `memory list -s <store>` returns empty:
1. Check `store list` for the store path
2. Verify an `index.yaml` exists at that path
3. Run `store reindex -s <store>` to rebuild indexes