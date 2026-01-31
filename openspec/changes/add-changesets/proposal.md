# Change: Add Changesets for Version Management

## Why

With the transition to a monorepo, we need a consistent way to manage versioning across multiple packages. Changesets provides:

- Synchronized versioning across all packages
- Automated changelog generation
- Developer-friendly workflow for documenting changes
- Integration with CI for automated publishing

Without a version management tool, coordinating releases across 4 packages would be error-prone and manual.

## What Changes

**Install and configure Changesets:**

- Add `@changesets/cli` as a dev dependency
- Create `.changeset/config.json` with synchronized versioning

**Add Changeset workflow:**

- Developers run `bun changeset` to create changeset files
- Changeset files describe the change and version bump type
- CI consumes changesets during release

**Documentation:**

- Document changeset workflow in CONTRIBUTING.md or root README
- Add changeset creation to PR checklist

## Impact

- Affected specs: None (tooling addition)
- Affected code:
    - Root `package.json` - new dev dependency and scripts
    - `.changeset/` directory - configuration and changeset files
- **NOT breaking for users**: Tooling change only
