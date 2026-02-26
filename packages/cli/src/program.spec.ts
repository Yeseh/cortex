/**
 * Unit tests for the Commander.js program setup and runProgram entrypoint.
 *
 * Verifies that the program is correctly wired with the expected name,
 * version, and top-level subcommands, and that `runProgram` is exported
 * as a callable function.
 *
 * @module cli/program.spec
 */

import { describe, it, expect } from 'bun:test';

import { program, runProgram } from './program.ts';

describe('program', () => {
    it('should have name "cortex"', () => {
        expect(program.name()).toBe('cortex');
    });

    it('should have version "0.1.0"', () => {
        expect(program.version()).toBe('0.1.0');
    });

    it('should have "memory" command registered', () => {
        const names = program.commands.map((c) => c.name());
        expect(names).toContain('memory');
    });

    it('should have "store" command registered', () => {
        const names = program.commands.map((c) => c.name());
        expect(names).toContain('store');
    });

    it('should have "init" command registered', () => {
        const names = program.commands.map((c) => c.name());
        expect(names).toContain('init');
    });
});

describe('runProgram', () => {
    it('should be a function', () => {
        // Do NOT call runProgram() — it would parse process.argv and trigger
        // real command execution. We only verify it is exported correctly.
        expect(typeof runProgram).toBe('function');
    });
});
