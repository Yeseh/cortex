# Tasks: Add Category Hierarchy Configuration

## 1. Config Schema

- [x] 1.1 Define `CategoryMode` type (`free | subcategories | strict`)
- [x] 1.2 Define `CategoryDefinition` type (recursive with description and subcategories)
- [x] 1.3 Add `categoryMode` and `categories` fields to store config schema
- [x] 1.4 Implement config parsing for nested category hierarchies
- [x] 1.5 Add validation for category definitions (paths, descriptions)
- [x] 1.6 Write unit tests for config parsing with hierarchies

## 2. Store Metadata

- [x] 2.1 Update `StoreInfo` type to include `categoryMode` and `categories`
- [x] 2.2 Implement helper to flatten nested categories to paths
- [x] 2.3 Implement helper to check if a category path is config-defined

## 3. MCP Store Resources

- [x] 3.1 Update `list_stores` response to include hierarchy from config
- [x] 3.2 Update `cortex://store/{name}` resource to include category mode
- [x] 3.3 Write integration tests for updated response shapes

## 4. Documentation

- [x] 4.1 Update config.yaml example in README
- [x] 4.2 Document category hierarchy schema
