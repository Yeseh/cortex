/**
 * Unit tests for shared memory tool helpers.
 *
 * @module server/memory/tools/shared.spec
 */

import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import type { MemoryError } from '@yeseh/cortex-core';
import { translateMemoryError, parseInput } from './shared.ts';

// ---------------------------------------------------------------------------
// Helper: build a MemoryError without reaching into core internals
// ---------------------------------------------------------------------------

const memErr = (
    code: MemoryError['code'],
    message = 'test message',
    path?: string,
): MemoryError => ({ code, message, ...(path ? { path } : {}) });

// ---------------------------------------------------------------------------
// translateMemoryError
// ---------------------------------------------------------------------------

describe('translateMemoryError', () => {
    describe('MEMORY_NOT_FOUND', () => {
        it('should return InvalidParams with path in message', () => {
            const error = memErr('MEMORY_NOT_FOUND', 'Not found', 'cat/slug');
            const result = translateMemoryError(error);
            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
            expect(result.message).toContain('cat/slug');
        });
    });

    describe('MEMORY_EXPIRED', () => {
        it('should return InvalidParams with path in message', () => {
            const error = memErr('MEMORY_EXPIRED', 'Expired', 'cat/old');
            const result = translateMemoryError(error);
            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
            expect(result.message).toContain('cat/old');
        });
    });

    describe('INVALID_PATH', () => {
        it('should return InvalidParams and preserve the original message', () => {
            const error = memErr('INVALID_PATH', 'Path must include a category');
            const result = translateMemoryError(error);
            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
            expect(result.message).toContain('Path must include a category');
        });
    });

    describe('INVALID_INPUT', () => {
        it('should return InvalidParams', () => {
            const error = memErr('INVALID_INPUT', 'No updates provided');
            const result = translateMemoryError(error);
            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });
    });

    describe('DESTINATION_EXISTS', () => {
        it('should return InvalidParams with path in message', () => {
            const error = memErr('DESTINATION_EXISTS', 'Exists', 'cat/dest');
            const result = translateMemoryError(error);
            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
            expect(result.message).toContain('cat/dest');
        });
    });

    describe('MISSING_FRONTMATTER', () => {
        it('should return InternalError with "corrupted" in message', () => {
            const error = memErr('MISSING_FRONTMATTER', 'No frontmatter');
            const result = translateMemoryError(error);
            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
            expect(result.message).toContain('corrupted');
        });
    });

    describe('INVALID_FRONTMATTER', () => {
        it('should return InternalError', () => {
            const error = memErr('INVALID_FRONTMATTER', 'Bad YAML');
            const result = translateMemoryError(error);
            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });
    });

    describe('STORAGE_ERROR', () => {
        it('should return InternalError', () => {
            const error = memErr('STORAGE_ERROR', 'Disk full');
            const result = translateMemoryError(error);
            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });
    });

    describe('unknown code', () => {
        it('should return InternalError containing "Unknown error"', () => {
            // Force an unsupported code via cast
            const error = { code: 'TOTALLY_UNKNOWN' as MemoryError['code'], message: 'what' };
            const result = translateMemoryError(error);
            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
            expect(result.message).toContain('Unknown error');
        });
    });
});

// ---------------------------------------------------------------------------
// parseInput
// ---------------------------------------------------------------------------

const testSchema = z.object({ name: z.string() });

describe('parseInput', () => {
    it('should return parsed value for valid input', () => {
        const result = parseInput(testSchema, { name: 'Alice' });
        expect(result).toEqual({ name: 'Alice' });
    });

    it('should throw McpError with InvalidParams for invalid input', () => {
        let threw = false;
        try {
            parseInput(testSchema, { name: 42 });
        } catch (e) {
            threw = true;
            expect(e).toBeInstanceOf(McpError);
            expect((e as McpError).code).toBe(ErrorCode.InvalidParams);
        }
        expect(threw).toBe(true);
    });

    it('should include field path and message in the thrown error', () => {
        let threw = false;
        try {
            parseInput(testSchema, { name: 42 });
        } catch (e) {
            threw = true;
            const msg = (e as McpError).message;
            // Zod puts the field path ("name") and the issue message
            expect(msg).toContain('name');
        }
        expect(threw).toBe(true);
    });

    it('should throw McpError with InvalidParams when required field is missing', () => {
        let threw = false;
        try {
            parseInput(testSchema, {});
        } catch (e) {
            threw = true;
            expect(e).toBeInstanceOf(McpError);
            expect((e as McpError).code).toBe(ErrorCode.InvalidParams);
        }
        expect(threw).toBe(true);
    });
});
