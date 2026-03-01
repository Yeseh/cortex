---
'@yeseh/cortex-core': patch
---

Seed default project categories when initialising a store without explicit categories

`cortex store init` now pre-populates new stores with `defaultProjectCategories` (admin, tasks, standup, decisions, standards/coding) when no categories are provided. Previously the categories array was empty in both the config file and on disk.

Two bugs are fixed:

- Category directories and descriptions were not created because the seeding happened after `config.saveStore`, so `config.yaml` always wrote `categories: {}`.
- `initializeStore` only called `categories.ensure` (mkdir) but never `categories.setDescription`, so category descriptions were never written to the index files.

The fix resolves both by resolving `initialCategories` before saving the config, and by recursively calling `ensure` + `setDescription` for every category node (including subcategories).
