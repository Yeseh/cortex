/**
 * Unit tests for store command group wiring and resolveStoreName logic.
 *
 * Verifies that the `store` command group is correctly configured and that
 * `resolveStoreName` follows its priority-based resolution strategy.
 *
 * Note on Slug.from behavior: The `Slug.from` function used internally is a
 * normalizer rather than a strict validator — it lowercases, replaces
 * non-alphanumeric characters with hyphens, and only rejects empty/whitespace
 * strings. As a result `resolveStoreName`:
 *   - Normalizes explicit names (e.g. "MY STORE" → "my-store")
 *   - Only rejects empty explicit names
 *   - Falls back to folder-name normalization rather than throwing for most inputs
 *
 * @module cli/store/index.spec
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { storeCommand, resolveStoreName } from './index.ts';

// ── storeCommand wiring ──────────────────────────────────────────────────────

describe('storeCommand', () => {
    it('should have name "store"', () => {
        expect(storeCommand.name()).toBe('store');
    });

    it('should have description', () => {
        expect(storeCommand.description()).toBeTruthy();
    });

    it('should have --store option', () => {
        const storeOption = storeCommand.options.find((o) => o.long === '--store');
        expect(storeOption).toBeDefined();
        expect(storeOption?.short).toBe('-s');
    });

    it('should have "list" subcommand', () => {
        const names = storeCommand.commands.map((c) => c.name());
        expect(names).toContain('list');
    });

    it('should have "add" subcommand', () => {
        const names = storeCommand.commands.map((c) => c.name());
        expect(names).toContain('add');
    });

    it('should have "remove" subcommand', () => {
        const names = storeCommand.commands.map((c) => c.name());
        expect(names).toContain('remove');
    });

    it('should have "init" subcommand', () => {
        const names = storeCommand.commands.map((c) => c.name());
        expect(names).toContain('init');
    });

    it('should have "prune" subcommand', () => {
        const names = storeCommand.commands.map((c) => c.name());
        expect(names).toContain('prune');
    });

    it('should have "reindex" subcommand', () => {
        const names = storeCommand.commands.map((c) => c.name());
        expect(names).toContain('reindex');
    });
});

// ── resolveStoreName ─────────────────────────────────────────────────────────

describe('resolveStoreName', () => {
    const createdDirs: string[] = [];

    afterEach(async () => {
        for (const dir of createdDirs.splice(0)) {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('should return explicit name when provided', async () => {
        const name = await resolveStoreName('/some/dir', 'my-store');
        expect(name).toBe('my-store');
    });

    it('should normalize explicit name with uppercase letters to lowercase slug', async () => {
        // Slug.from normalizes rather than rejects — uppercase becomes lowercase
        const name = await resolveStoreName('/some/dir', 'MY-STORE');
        expect(name).toBe('my-store');
    });

    it('should normalize explicit name with spaces and special characters', async () => {
        // Non-alphanumeric characters (including spaces) are replaced with hyphens
        const name = await resolveStoreName('/some/dir', 'My Project Store!');
        expect(name).toBe('my-project-store');
    });

    it('should detect git repo name as a valid slug', async () => {
        // The worktree IS a git repo; its toplevel basename is "cli-unit-tests"
        const cwd = '/home/jesse/repo/cortex/.worktrees/cli-unit-tests';
        const name = await resolveStoreName(cwd);
        expect(name).toBe('cli-unit-tests');
    });

    it('should fall back to folder name when not in git repo', async () => {
        // Create a temp dir outside any git repo (in /tmp)
        const dir = await mkdtemp(join(tmpdir(), 'test-store-fallback-'));
        createdDirs.push(dir);

        const name = await resolveStoreName(dir);
        // Slug.from normalizes the basename; result should be a non-empty string
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
    });

    it('should normalize folder name to slug when not in git repo', async () => {
        // Create a temp dir with a known prefix so we can assert the normalized name
        const dir = join(tmpdir(), `valid-slug-${Date.now()}`);
        await mkdir(dir, { recursive: true });
        createdDirs.push(dir);

        const name = await resolveStoreName(dir);
        // The basename "valid-slug-<timestamp>" contains only valid slug chars (lowercase, hyphens, digits)
        expect(name).toMatch(/^valid-slug-\d+$/);
    });
});
