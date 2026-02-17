# Tasks: Add CLI Category Bootstrapping

## 1. Template System

- [ ] 1.1 Define `StoreTemplate` type (mode, categories, description)
- [ ] 1.2 Create `agent-project` template (standards, decisions, todo, map categories)
- [ ] 1.3 Create `minimal` template (free mode, no predefined categories)
- [ ] 1.4 Create `personal` template (human profile, preferences)
- [ ] 1.5 Implement template registry/loader

## 2. Store Init Command

- [ ] 2.1 Add `--template` option to `cortex store init`
- [ ] 2.2 Implement config.yaml writing with hierarchy
- [ ] 2.3 Call `createCategory` for each template category
- [ ] 2.4 Write unit tests for template application

## 3. Global Init Command

- [ ] 3.1 Add `--template` option to `cortex init`
- [ ] 3.2 Default to `personal` template for global init
- [ ] 3.3 Write unit tests for global init with templates

## 4. Documentation

- [ ] 4.1 Document available templates
- [ ] 4.2 Add examples to CLI help text
