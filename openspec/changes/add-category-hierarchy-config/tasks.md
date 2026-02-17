# Tasks: Add Category Hierarchy Configuration

## 1. Config Schema

- [ ] 1.1 Define `CategoryMode` type (`free | subcategories | strict`)
- [ ] 1.2 Define `CategoryDefinition` type (recursive with description and subcategories)
- [ ] 1.3 Add `categoryMode` and `categories` fields to store config schema
- [ ] 1.4 Implement config parsing for nested category hierarchies
- [ ] 1.5 Add validation for category definitions (paths, descriptions)
- [ ] 1.6 Write unit tests for config parsing with hierarchies

## 2. Store Metadata

- [ ] 2.1 Update `StoreInfo` type to include `categoryMode` and `categories`
- [ ] 2.2 Implement helper to flatten nested categories to paths
- [ ] 2.3 Implement helper to check if a category path is config-defined

## 3. MCP Store Resources

- [ ] 3.1 Update `list_stores` response to include hierarchy from config
- [ ] 3.2 Update `cortex://store/{name}` resource to include category mode
- [ ] 3.3 Write integration tests for updated response shapes

## 4. Documentation

- [ ] 4.1 Update config.yaml example in README
- [ ] 4.2 Document category hierarchy schema
