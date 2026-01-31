## 1. Install Changesets

- [ ] 1.1 Add `@changesets/cli` as root dev dependency
- [ ] 1.2 Run `bun changeset init` to create `.changeset/` directory

## 2. Configure Changesets

- [ ] 2.1 Update `.changeset/config.json` for synchronized versioning
- [ ] 2.2 Set `access` to `restricted` for GitHub Packages
- [ ] 2.3 Configure `baseBranch` to `main`
- [ ] 2.4 Set `fixed` array to group all packages for synchronized versions

## 3. Add scripts to root package.json

- [ ] 3.1 Add `changeset` script: `changeset`
- [ ] 3.2 Add `version` script: `changeset version`
- [ ] 3.3 Add `release` script: `changeset publish`

## 4. Create initial changeset

- [ ] 4.1 Create a changeset documenting the monorepo restructure
- [ ] 4.2 Set initial version to 0.1.0 across all packages

## 5. Documentation

- [ ] 5.1 Document changeset workflow (when to create, how to create)
- [ ] 5.2 Add changeset requirement to PR process
