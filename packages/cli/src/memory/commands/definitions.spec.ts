/**
 * Unit tests for memory command definitions.
 *
 * Verifies that memory subcommands expose the expected names,
 * arguments, and options.
 *
 * @module cli/memory/commands/definitions.spec
 */

import { describe, expect, it } from 'bun:test';

import { listCommand } from './list.ts';
import { moveCommand } from './move.ts';
import { removeCommand } from './remove.ts';
import { showCommand } from './show.ts';
import { updateCommand } from './update.ts';

const getLongOptions = (command: { options: Array<{ long?: string }> }): string[] =>
    command.options.map((option) => option.long ?? '').filter(Boolean);

describe('memory command definitions', () => {
    describe('listCommand', () => {
        it('should expose expected command name and usage', () => {
            expect(listCommand.name()).toBe('list');
            expect(listCommand.usage()).toContain('[category]');
        });

        it('should register expected options', () => {
            const options = getLongOptions(listCommand);
            expect(options).toContain('--store');
            expect(options).toContain('--include-expired');
            expect(options).toContain('--format');
        });
    });

    describe('moveCommand', () => {
        it('should expose expected command name and usage', () => {
            expect(moveCommand.name()).toBe('move');
            expect(moveCommand.usage()).toContain('<from>');
            expect(moveCommand.usage()).toContain('<to>');
        });
    });

    describe('removeCommand', () => {
        it('should expose expected command name and usage', () => {
            expect(removeCommand.name()).toBe('remove');
            expect(removeCommand.usage()).toContain('<path>');
        });
    });

    describe('showCommand', () => {
        it('should expose expected command name and usage', () => {
            expect(showCommand.name()).toBe('show');
            expect(showCommand.usage()).toContain('<path>');
        });

        it('should register expected options', () => {
            const options = getLongOptions(showCommand);
            expect(options).toContain('--include-expired');
            expect(options).toContain('--format');
        });
    });

    describe('updateCommand', () => {
        it('should expose expected command name and usage', () => {
            expect(updateCommand.name()).toBe('update');
            expect(updateCommand.usage()).toContain('<path>');
        });

        it('should register expected options', () => {
            const options = getLongOptions(updateCommand);
            expect(options).toContain('--content');
            expect(options).toContain('--file');
            expect(options).toContain('--tags');
            expect(options).toContain('--expires-at');
            expect(options).toContain('--no-expires-at');
            expect(options).toContain('--citation');
        });
    });
});
