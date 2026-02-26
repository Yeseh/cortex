/**
 * Tests for MCP response builder utilities.
 *
 * @module server/response.spec
 */

import { describe, expect, it } from 'bun:test';
import { textResponse, jsonResponse, errorResponse, type McpToolResponse } from './response.ts';

// Helper: asserts content has at least one item and returns it
function firstItem(response: McpToolResponse): { type: 'text'; text: string } {
    expect(response.content.length).toBeGreaterThan(0);
    const item = response.content[0];
    if (!item) throw new Error('content[0] is undefined');
    return item;
}

describe('textResponse', () => {
    it('should return a response with content[0].text equal to the input string', () => {
        const result = textResponse('hello world');

        expect(firstItem(result).text).toBe('hello world');
    });

    it('should set content[0].type to "text"', () => {
        const result = textResponse('some text');

        expect(firstItem(result).type).toBe('text');
    });

    it('should return exactly one content item', () => {
        const result = textResponse('one item');

        expect(result.content).toHaveLength(1);
    });

    it('should NOT set isError for a normal text response', () => {
        const result = textResponse('no error');

        expect(result.isError).toBeFalsy();
    });

    it('should not have isError property on a normal text response', () => {
        const result = textResponse('no error');

        expect('isError' in result).toBe(false);
    });

    it('should preserve an empty string input', () => {
        const result = textResponse('');

        expect(firstItem(result).text).toBe('');
    });

    it('should preserve a multi-line string input', () => {
        const multiLine = 'line one\nline two\nline three';
        const result = textResponse(multiLine);

        expect(firstItem(result).text).toBe(multiLine);
    });

    it('should preserve special characters in the input', () => {
        const special = '<b>bold</b> & "quoted" \'single\'';
        const result = textResponse(special);

        expect(firstItem(result).text).toBe(special);
    });
});

describe('jsonResponse', () => {
    it('should return a response with content[0].text equal to the input string', () => {
        const json = '{"key":"value"}';
        const result = jsonResponse(json);

        expect(firstItem(result).text).toBe(json);
    });

    it('should set content[0].type to "text" (normalized from json input)', () => {
        // createResponse always outputs type: 'text' regardless of input type hint
        const result = jsonResponse('{}');

        expect(firstItem(result).type).toBe('text');
    });

    it('should return exactly one content item', () => {
        const result = jsonResponse('[]');

        expect(result.content).toHaveLength(1);
    });

    it('should NOT set isError for a json response', () => {
        const result = jsonResponse('{"ok":true}');

        expect(result.isError).toBeFalsy();
    });

    it('should not have isError property on a json response', () => {
        const result = jsonResponse('{"ok":true}');

        expect('isError' in result).toBe(false);
    });

    it('should preserve the raw JSON string without parsing', () => {
        const rawJson = '{"nested":{"a":1},"arr":[1,2,3]}';
        const result = jsonResponse(rawJson);

        expect(firstItem(result).text).toBe(rawJson);
    });
});

describe('errorResponse', () => {
    it('should prefix the input with "Error: "', () => {
        const result = errorResponse('something went wrong');

        expect(firstItem(result).text).toBe('Error: something went wrong');
    });

    it('should set isError to true', () => {
        const result = errorResponse('failure');

        expect(result.isError).toBe(true);
    });

    it('should set content[0].type to "text"', () => {
        const result = errorResponse('bad input');

        expect(firstItem(result).type).toBe('text');
    });

    it('should return exactly one content item', () => {
        const result = errorResponse('oops');

        expect(result.content).toHaveLength(1);
    });

    it('should preserve an empty string input (still prefixed)', () => {
        const result = errorResponse('');

        expect(firstItem(result).text).toBe('Error: ');
        expect(result.isError).toBe(true);
    });

    it('should preserve special characters in the error message', () => {
        const msg = 'not found: /path/to/file.ts:42';
        const result = errorResponse(msg);

        expect(firstItem(result).text).toBe(`Error: ${msg}`);
        expect(result.isError).toBe(true);
    });

    it('should not lose the isError flag for multi-word messages', () => {
        const result = errorResponse('store not found: my-store');

        expect(result.isError).toBe(true);
        expect(firstItem(result).text).toContain('store not found');
    });
});

describe('McpToolResponse shape', () => {
    it('textResponse should conform to McpToolResponse interface', () => {
        const result: McpToolResponse = textResponse('test');

        expect(Array.isArray(result.content)).toBe(true);
        const item = firstItem(result);
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('text');
    });

    it('jsonResponse should conform to McpToolResponse interface', () => {
        const result: McpToolResponse = jsonResponse('{}');

        expect(Array.isArray(result.content)).toBe(true);
        const item = firstItem(result);
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('text');
    });

    it('errorResponse should conform to McpToolResponse interface', () => {
        const result: McpToolResponse = errorResponse('test error');

        expect(Array.isArray(result.content)).toBe(true);
        const item = firstItem(result);
        expect(item).toHaveProperty('type');
        expect(item).toHaveProperty('text');
        expect(result).toHaveProperty('isError');
    });

    it('non-error responses should have no isError while error response does', () => {
        const text = textResponse('ok');
        const json = jsonResponse('{}');
        const error = errorResponse('bad');

        expect('isError' in text).toBe(false);
        expect('isError' in json).toBe(false);
        expect('isError' in error).toBe(true);
        expect(error.isError).toBe(true);
    });
});
