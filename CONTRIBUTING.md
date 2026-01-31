# Contributing to Cortex

Thank you for your interest in contributing to Cortex!

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yeseh/cortex.git
cd cortex

# Install dependencies
bun install

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint
```

## Making Changes

### Changesets

We use [changesets](https://github.com/changesets/changesets) to manage versions and changelogs. When making changes that affect package behavior, you need to create a changeset.

#### When to Create a Changeset

Create a changeset for:

- New features
- Bug fixes
- Breaking changes
- Any change that affects the public API

Skip changesets for:

- Documentation-only changes
- Internal refactoring with no user impact
- Test-only changes

#### Creating a Changeset

```bash
# Run the changeset command
bun changeset

# Follow the prompts:
# 1. Select which packages are affected
# 2. Choose the bump type (patch/minor/major)
# 3. Write a summary of the change
```

This creates a markdown file in `.changeset/` describing your change.

#### Versioning Guidelines

- **patch**: Bug fixes, documentation updates
- **minor**: New features, non-breaking enhancements
- **major**: Breaking changes (API changes, removed features)

All packages are versioned together (synchronized versioning), so selecting any package will bump all packages to the same version.

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Create a changeset (if applicable)
4. Run tests: `bun test`
5. Run type check: `bun run typecheck`
6. Submit a pull request

### Commit Messages

Follow conventional commit format:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions or fixes
- `chore:` Maintenance tasks

## Project Structure

See the [README](./README.md#project-structure) for details on the monorepo structure.

## Code Style

- TypeScript for all code
- ESLint for linting
- Prettier for formatting

Run `bun run lint` and `bun run format` before committing.
