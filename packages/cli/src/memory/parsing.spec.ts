/**
 * Unit tests for memory/parsing.ts
 *
 * @module cli/memory/parsing.spec
 */

import { describe, it, expect } from 'bun:test';
import { parseTags, parseExpiresAt } from './parsing';
import { expectInvalidArgumentError } from '../test-helpers.spec';

// ============================================================================
// parseTags
// ============================================================================

describe('parseTags', () => {
    it('should return empty array for undefined input', () => {
        expect(parseTags(undefined)).toEqual([]);
    });

    it('should return empty array for empty array input', () => {
        expect(parseTags([])).toEqual([]);
    });

    it('should split comma-separated tags from a single string', () => {
        expect(parseTags(['foo,bar,baz'])).toEqual([
            'foo',
            'bar',
            'baz',
        ]);
    });

    it('should handle multiple string entries in the array', () => {
        expect(parseTags([
            'foo', 'bar',
        ])).toEqual([
            'foo', 'bar',
        ]);
    });

    it('should trim whitespace from each tag', () => {
        expect(parseTags([' foo , bar , baz '])).toEqual([
            'foo',
            'bar',
            'baz',
        ]);
    });

    it('should filter empty strings after splitting and trimming', () => {
        expect(parseTags([
            ',,,', '  ,  ',
        ])).toEqual([]);
    });

    it('should preserve duplicate tags without deduplication', () => {
        expect(parseTags([
            'foo,foo', 'foo',
        ])).toEqual([
            'foo',
            'foo',
            'foo',
        ]);
    });
});

// ============================================================================
// parseExpiresAt
// ============================================================================

describe('parseExpiresAt', () => {
    it('should return undefined for undefined input', () => {
        expect(parseExpiresAt(undefined)).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
        expect(parseExpiresAt('')).toBeUndefined();
    });

    it('should return a Date for valid ISO 8601 string', () => {
        const result = parseExpiresAt('2025-12-31T23:59:59.000Z');
        expect(result).toBeInstanceOf(Date);
        expect(result!.toISOString()).toBe('2025-12-31T23:59:59.000Z');
    });

    it('should return a Date for valid date-only string "2025-12-31"', () => {
        const result = parseExpiresAt('2025-12-31');
        expect(result).toBeInstanceOf(Date);
        expect(result!.getFullYear()).toBe(2025);
        expect(result!.getMonth()).toBe(11); // 0-indexed December
        expect(result!.getDate()).toBe(31);
    });

    it('should throw InvalidArgumentError for invalid date string "not-a-date"', async () => {
        await expectInvalidArgumentError(
            () => parseExpiresAt('not-a-date'),
            'Invalid expiration date format',
        );
    });

    it('should throw InvalidArgumentError for garbage string "abc123"', async () => {
        await expectInvalidArgumentError(
            () => parseExpiresAt('abc123'),
            'Invalid expiration date format',
        );
    });
});
