/**
 * Tests for the domain error to MCP error translation layer.
 *
 * @module server/errors.spec
 */

import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { domainErrorToMcpError, zodErrorToMcpError, handleDomainError } from './errors.ts';

describe('domainErrorToMcpError', () => {
    describe('config error codes', () => {
        it('should map CONFIG_READ_FAILED to InternalError', () => {
            const result = domainErrorToMcpError('CONFIG_READ_FAILED', 'Could not read config');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });

        it('should map CONFIG_PARSE_FAILED to InvalidRequest', () => {
            const result = domainErrorToMcpError('CONFIG_PARSE_FAILED', 'Invalid YAML syntax');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidRequest);
        });

        it('should map CONFIG_VALIDATION_FAILED to InvalidParams', () => {
            const result = domainErrorToMcpError('CONFIG_VALIDATION_FAILED', 'Config value invalid');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });
    });

    describe('store resolution error codes', () => {
        it('should map LOCAL_STORE_MISSING to InvalidParams', () => {
            const result = domainErrorToMcpError('LOCAL_STORE_MISSING', 'Store not found');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map GLOBAL_STORE_MISSING to InvalidParams', () => {
            const result = domainErrorToMcpError('GLOBAL_STORE_MISSING', 'Global store not found');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map STORE_ACCESS_FAILED to InternalError', () => {
            const result = domainErrorToMcpError('STORE_ACCESS_FAILED', 'Permission denied');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });
    });

    describe('store registry save error codes', () => {
        it('should map REGISTRY_WRITE_FAILED to InternalError', () => {
            const result = domainErrorToMcpError('REGISTRY_WRITE_FAILED', 'Could not write registry');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });

        it('should map REGISTRY_SERIALIZE_FAILED to InternalError', () => {
            const result = domainErrorToMcpError('REGISTRY_SERIALIZE_FAILED', 'Serialization failed');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });
    });

    describe('store registry load error codes', () => {
        it('should map REGISTRY_READ_FAILED to InternalError', () => {
            const result = domainErrorToMcpError('REGISTRY_READ_FAILED', 'Could not read registry');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });

        it('should map REGISTRY_PARSE_FAILED to InvalidRequest', () => {
            const result = domainErrorToMcpError('REGISTRY_PARSE_FAILED', 'Invalid registry YAML');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidRequest);
        });

        it('should map REGISTRY_MISSING to InvalidParams', () => {
            const result = domainErrorToMcpError('REGISTRY_MISSING', 'Registry file missing');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });
    });

    describe('store registry parse error codes', () => {
        it('should map MISSING_STORES_SECTION to InvalidRequest', () => {
            const result = domainErrorToMcpError('MISSING_STORES_SECTION', 'Missing stores section');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidRequest);
        });

        it('should map INVALID_STORES_SECTION to InvalidRequest', () => {
            const result = domainErrorToMcpError('INVALID_STORES_SECTION', 'Stores section invalid');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidRequest);
        });

        it('should map INVALID_STORE_NAME to InvalidParams', () => {
            const result = domainErrorToMcpError('INVALID_STORE_NAME', 'Store name invalid');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map DUPLICATE_STORE_NAME to InvalidParams', () => {
            const result = domainErrorToMcpError('DUPLICATE_STORE_NAME', 'Duplicate store name');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map MISSING_STORE_PATH to InvalidParams', () => {
            const result = domainErrorToMcpError('MISSING_STORE_PATH', 'Store path missing');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map INVALID_STORE_PATH to InvalidParams', () => {
            const result = domainErrorToMcpError('INVALID_STORE_PATH', 'Store path invalid');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map UNEXPECTED_ENTRY to InvalidRequest', () => {
            const result = domainErrorToMcpError('UNEXPECTED_ENTRY', 'Unexpected registry entry');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidRequest);
        });
    });

    describe('memory validation error codes', () => {
        it('should map INVALID_SLUG to InvalidParams', () => {
            const result = domainErrorToMcpError('INVALID_SLUG', 'Slug must be kebab-case');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map INVALID_CATEGORY_DEPTH to InvalidParams', () => {
            const result = domainErrorToMcpError('INVALID_CATEGORY_DEPTH', 'Category too shallow');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map INVALID_SLUG_PATH to InvalidParams', () => {
            const result = domainErrorToMcpError('INVALID_SLUG_PATH', 'Slug path malformed');

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });
    });

    describe('message preservation', () => {
        it('should preserve the error message in the McpError', () => {
            const message = 'Slug must be kebab-case, e.g. "my-memory"';
            const result = domainErrorToMcpError('INVALID_SLUG', message);

            expect(result.message).toContain(message);
        });

        it('should preserve an empty message', () => {
            const result = domainErrorToMcpError('INVALID_SLUG', '');

            // McpError prepends "MCP error <code>: " — the original message is still contained
            expect(result.message).toContain('MCP error');
        });

        it('should preserve a message with special characters', () => {
            const message = 'Path "/foo/bar" contains: invalid chars & symbols';
            const result = domainErrorToMcpError('CONFIG_READ_FAILED', message);

            expect(result.message).toContain(message);
        });

        it('should return a new McpError instance on each call', () => {
            const first = domainErrorToMcpError('INVALID_SLUG', 'same message');
            const second = domainErrorToMcpError('INVALID_SLUG', 'same message');

            expect(first).not.toBe(second);
        });
    });
});

describe('zodErrorToMcpError', () => {
    it('should return an McpError with InvalidParams code', () => {
        const schema = z.object({ name: z.string() });
        const parseResult = schema.safeParse({ name: 123 });
        expect(parseResult.success).toBe(false);
        if (parseResult.success) return;

        const result = zodErrorToMcpError(parseResult.error);

        expect(result).toBeInstanceOf(McpError);
        expect(result.code).toBe(ErrorCode.InvalidParams);
    });

    it('should format a single issue as "field: message"', () => {
        const schema = z.object({ name: z.string() });
        const parseResult = schema.safeParse({ name: 123 });
        expect(parseResult.success).toBe(false);
        if (parseResult.success) return;

        const result = zodErrorToMcpError(parseResult.error);

        expect(result.message).toContain('name:');
        expect(result.message).toContain('expected string, received number');
    });

    it('should join multiple issues with "; "', () => {
        const schema = z.object({ name: z.string(), age: z.number() });
        const parseResult = schema.safeParse({ name: 42, age: 'not-a-number' });
        expect(parseResult.success).toBe(false);
        if (parseResult.success) return;

        const result = zodErrorToMcpError(parseResult.error);

        // Both fields should appear, separated by "; "
        expect(result.message).toContain('name:');
        expect(result.message).toContain('age:');
        expect(result.message).toContain('; ');
    });

    it('should include nested field paths using dot notation', () => {
        const schema = z.object({ user: z.object({ email: z.string().email() }) });
        const parseResult = schema.safeParse({ user: { email: 'not-an-email' } });
        expect(parseResult.success).toBe(false);
        if (parseResult.success) return;

        const result = zodErrorToMcpError(parseResult.error);

        expect(result.message).toContain('user.email:');
    });

    it('should handle a ZodError with a required field missing', () => {
        const schema = z.object({ id: z.string() });
        const parseResult = schema.safeParse({});
        expect(parseResult.success).toBe(false);
        if (parseResult.success) return;

        const result = zodErrorToMcpError(parseResult.error);

        expect(result).toBeInstanceOf(McpError);
        expect(result.code).toBe(ErrorCode.InvalidParams);
        expect(result.message).toContain('id:');
    });

    it('should include the issue message from the ZodError', () => {
        const schema = z.object({ count: z.number().min(1, 'Must be at least 1') });
        const parseResult = schema.safeParse({ count: 0 });
        expect(parseResult.success).toBe(false);
        if (parseResult.success) return;

        const result = zodErrorToMcpError(parseResult.error);

        expect(result.message).toContain('Must be at least 1');
    });
});

describe('handleDomainError', () => {
    describe('known domain error codes', () => {
        it('should map a known code (INVALID_SLUG) to InvalidParams', () => {
            const error = { code: 'INVALID_SLUG', message: 'Slug is invalid' };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map a known code (LOCAL_STORE_MISSING) to InvalidParams', () => {
            const error = { code: 'LOCAL_STORE_MISSING', message: 'Store not found' };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
        });

        it('should map a known code (CONFIG_READ_FAILED) to InternalError', () => {
            const error = { code: 'CONFIG_READ_FAILED', message: 'Could not read config' };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });

        it('should map a known code (REGISTRY_WRITE_FAILED) to InternalError', () => {
            const error = { code: 'REGISTRY_WRITE_FAILED', message: 'Write failed' };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });

        it('should map a known code (CONFIG_PARSE_FAILED) to InvalidRequest', () => {
            const error = { code: 'CONFIG_PARSE_FAILED', message: 'Parse error' };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidRequest);
        });
    });

    describe('unknown error codes', () => {
        it('should fall back to InternalError for an unknown code', () => {
            const error = { code: 'SOME_UNKNOWN_ERROR', message: 'Something went wrong' };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });

        it('should fall back to InternalError for an empty string code', () => {
            const error = { code: '', message: 'Empty code error' };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });

        it('should fall back to InternalError for a numeric-looking code string', () => {
            const error = { code: '404', message: 'Not found' };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
        });
    });

    describe('message preservation', () => {
        it('should preserve the error message for known codes', () => {
            const message = 'Slug "My Memory!" contains invalid characters';
            const error = { code: 'INVALID_SLUG', message };
            const result = handleDomainError(error);

            expect(result.message).toContain(message);
        });

        it('should preserve the error message for unknown codes', () => {
            const message = 'An unexpected error occurred in subsystem X';
            const error = { code: 'UNKNOWN_SUBSYSTEM_ERROR', message };
            const result = handleDomainError(error);

            expect(result.message).toContain(message);
        });
    });

    describe('extra properties on error object', () => {
        it('should handle errors with additional properties gracefully', () => {
            const error = {
                code: 'INVALID_SLUG',
                message: 'Slug invalid',
                cause: 'some cause string',
                extra: 'ignored field',
            };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InvalidParams);
            expect(result.message).toContain('Slug invalid');
        });

        it('should handle errors with an Error object cause', () => {
            const cause = new Error('underlying cause');
            const error = { code: 'REGISTRY_READ_FAILED', message: 'Read failed', cause };
            const result = handleDomainError(error);

            expect(result).toBeInstanceOf(McpError);
            expect(result.code).toBe(ErrorCode.InternalError);
            expect(result.message).toContain('Read failed');
        });
    });
});
