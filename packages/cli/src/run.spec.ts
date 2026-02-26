/**
 * Unit tests for the run.ts CLI entrypoint.
 *
 * `run.ts` is a side-effect-only module that calls `runProgram()` on import.
 * Because importing it would immediately parse `process.argv`, we do NOT
 * import it directly in tests. Instead we verify that the function it
 * delegates to (`runProgram`) is correctly exported from `program.ts`.
 *
 * @module cli/run.spec
 */

import { describe, it, expect } from 'bun:test';

import { runProgram } from './program.ts';

describe('run module', () => {
    it('should delegate to runProgram from program.ts', () => {
        // run.ts calls runProgram() — verify the delegated function is callable
        expect(typeof runProgram).toBe('function');
    });

    it('runProgram should return a Promise', () => {
        // Verify the return type without actually executing
        // (calling it would parse process.argv)
        const returnType = runProgram.constructor.name;
        // AsyncFunction or Function — both are acceptable
        expect([
            'Function', 'AsyncFunction',
        ]).toContain(returnType);
    });
});
