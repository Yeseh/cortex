/**
 * Unit tests for store command group wiring.
 *
 * Verifies that the `store` command group is correctly configured.
 *
 * @module cli/store/index.spec
 */

import { describe, it, expect } from 'bun:test';

import { storeCommand } from './index.ts';

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

