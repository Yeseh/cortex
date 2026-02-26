/**
 * Unit tests for memory command group wiring.
 *
 * Verifies that the `memory` command group is correctly configured with
 * the expected name, description, options, and subcommands.
 *
 * @module cli/memory/index.spec
 */

import { describe, it, expect } from 'bun:test';

import { memoryCommand } from './index.ts';

describe('memoryCommand', () => {
    it('should have name "memory"', () => {
        expect(memoryCommand.name()).toBe('memory');
    });

    it('should have description', () => {
        expect(memoryCommand.description()).toBeTruthy();
    });

    it('should have --store option', () => {
        const options = memoryCommand.options;
        const storeOption = options.find((o) => o.long === '--store');
        expect(storeOption).toBeDefined();
        expect(storeOption?.short).toBe('-s');
    });

    it('should have "add" subcommand registered', () => {
        const names = memoryCommand.commands.map((c) => c.name());
        expect(names).toContain('add');
    });

    it('should have "show" subcommand registered', () => {
        const names = memoryCommand.commands.map((c) => c.name());
        expect(names).toContain('show');
    });

    it('should have "update" subcommand registered', () => {
        const names = memoryCommand.commands.map((c) => c.name());
        expect(names).toContain('update');
    });

    it('should have "remove" subcommand registered', () => {
        const names = memoryCommand.commands.map((c) => c.name());
        expect(names).toContain('remove');
    });

    it('should have "move" subcommand registered', () => {
        const names = memoryCommand.commands.map((c) => c.name());
        expect(names).toContain('move');
    });

    it('should have "list" subcommand registered', () => {
        const names = memoryCommand.commands.map((c) => c.name());
        expect(names).toContain('list');
    });
});
