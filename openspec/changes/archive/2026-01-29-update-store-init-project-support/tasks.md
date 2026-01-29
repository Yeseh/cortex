## 1. Git Repository Detection

- [x] 1.1 Create helper function to detect git repo root (`git rev-parse --show-toplevel`)
- [x] 1.2 Extract repository name from git root path (basename)
- [x] 1.3 Handle non-git directory case (return null/undefined)
- [x] 1.4 Add unit tests for git detection helper

## 2. CLI Flag and Validation

- [x] 2.1 Add `--name` flag to `store init` command
- [x] 2.2 Implement name resolution: `--name` flag > git detection > error
- [x] 2.3 Validate store name format (lowercase slug)
- [x] 2.4 Check for name collision in existing registry
- [x] 2.5 Return clear error messages for each failure case
- [x] 2.6 Add unit tests for flag parsing and validation

## 3. Store Registration

- [x] 3.1 Load existing store registry (or create empty)
- [x] 3.2 Add new store entry with resolved path
- [x] 3.3 Save updated registry to `~/.config/cortex/stores.yaml`
- [x] 3.4 Add integration tests for registration flow

## 4. Project Entry Creation

- [x] 4.1 After successful init and registration, create memory at `projects/{name}` in default store
- [x] 4.2 Include metadata: name, description (can be empty initially), store name
- [x] 4.3 Handle case where default store doesn't exist yet (skip gracefully)
- [x] 4.4 Add integration tests for project entry creation

## 5. Documentation

- [x] 5.1 Update CLI help text for `store init`
- [x] 5.2 Update memory skill with project store usage guidance
