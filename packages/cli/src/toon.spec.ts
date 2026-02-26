/**
 * Unit tests for toon.ts
 *
 * TOON (Token-Oriented Object Notation) encoder.
 *
 * @module cli/toon.spec
 */

import { describe, it, expect } from 'bun:test';
import { encode } from './toon';

// ============================================================================
// encode - primitives
// ============================================================================

describe('encode - primitives', () => {
    it('should encode a string primitive', () => {
        // Top-level primitive string: no key, just the value
        expect(encode('hello')).toBe('hello');
    });

    it('should encode a number primitive', () => {
        expect(encode(42)).toBe('42');
    });

    it('should encode a boolean primitive', () => {
        expect(encode(true)).toBe('true');
        expect(encode(false)).toBe('false');
    });

    it('should encode null as "null"', () => {
        expect(encode(null)).toBe('null');
    });

    it('should encode undefined as "null"', () => {
        expect(encode(undefined)).toBe('null');
    });

    it('should quote strings containing the delimiter (tab)', () => {
        expect(encode('hello\tworld')).toBe('"hello\\tworld"');
    });

    it('should quote strings containing a colon (:)', () => {
        expect(encode('key:value')).toBe('"key:value"');
    });

    it('should quote strings containing a newline', () => {
        expect(encode('line1\nline2')).toBe('"line1\\nline2"');
    });

    it('should quote strings containing a double quote', () => {
        expect(encode('"quoted"')).toBe('"\\"quoted\\""');
    });
});

// ============================================================================
// encode - flat objects
// ============================================================================

describe('encode - flat objects', () => {
    it('should encode a single key-value pair', () => {
        expect(encode({ name: 'test' })).toBe('name:test');
    });

    it('should encode multiple key-value pairs with tab delimiter', () => {
        expect(encode({ name: 'test', count: 42 })).toBe('name:test\tcount:42');
    });

    it('should use custom delimiter when specified', () => {
        expect(encode({ a: 1, b: 2 }, { delimiter: '|' })).toBe('a:1|b:2');
    });
});

// ============================================================================
// encode - nested objects (no key folding)
// ============================================================================

describe('encode - nested objects (no key folding)', () => {
    it('should encode nested object with inline braces', () => {
        // "user:{name:Alice\trole:admin}"
        expect(encode({ user: { name: 'Alice', role: 'admin' } })).toBe('user:{name:Alice\trole:admin}');
    });

    it('should handle deeply nested objects', () => {
        // "a:{b:{c:deep}}"
        expect(encode({ a: { b: { c: 'deep' } } })).toBe('a:{b:{c:deep}}');
    });
});

// ============================================================================
// encode - key folding
// ============================================================================

describe('encode - key folding', () => {
    it('should flatten nested object to dotted keys with keyFolding:safe', () => {
        expect(encode({ user: { name: 'Alice', role: 'admin' } }, { keyFolding: 'safe' }))
            .toBe('user.name:Alice\tuser.role:admin');
    });

    it('should handle multi-level nesting with keyFolding:safe', () => {
        expect(encode(
            { user: { profile: { name: 'Alice' }, settings: { theme: 'dark' } } },
            { keyFolding: 'safe' },
        )).toBe('user.profile.name:Alice\tuser.settings.theme:dark');
    });
});

// ============================================================================
// encode - arrays
// ============================================================================

describe('encode - arrays', () => {
    it('should encode uniform array of objects in tabular format', () => {
        const input = {
            items: [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' },
            ],
        };
        // items[2]{id\tname}:\n\t1\tAlice\n\t2\tBob
        const expected = 'items[2]{id\tname}:\n\t1\tAlice\n\t2\tBob';
        expect(encode(input)).toBe(expected);
    });

    it('should encode empty array as quoted empty string (serializePrimitive path)', () => {
        // isUniformArray returns false for empty arrays; the else branch in the
        // object serialiser calls serializePrimitive([], delimiter) which does
        // quoteString(String([])) → '""'
        expect(encode({ items: [] })).toBe('items:""');
    });

    it('should serialize non-uniform array via serializePrimitive (String coercion)', () => {
        // Non-uniform arrays fall through to the else branch in the object
        // serialiser → serializePrimitive → quoteString(String([...]))
        const input = {
            items: [
                { id: 1, name: 'Alice' },
                { id: 2 }, // missing 'name' key — non-uniform
            ],
        };
        expect(encode(input)).toBe('items:"[object Object],[object Object]"');
    });

    it('should serialize primitive array via serializePrimitive (comma-joined string)', () => {
        // Primitive arrays also go through serializePrimitive → quoteString(String([...]))
        expect(encode({ tags: [
            'a',
            'b',
            'c',
        ] })).toBe('tags:"a,b,c"');
    });

    it('should serialize array of mixed types via serializePrimitive', () => {
        expect(encode({ mixed: [
            1,
            'two',
            true,
        ] })).toBe('mixed:"1,two,true"');
    });
});

// ============================================================================
// encode - edge cases
// ============================================================================

describe('encode - edge cases', () => {
    it('should encode an empty object', () => {
        expect(encode({})).toBe('');
    });

    it('should handle object with array of uniform items alongside other fields', () => {
        const input = {
            title: 'Report',
            rows: [
                { id: 1, val: 'a' },
                { id: 2, val: 'b' },
            ],
        };
        // "title:Report\trows[2]{id\tval}:\n\t1\ta\n\t2\tb"
        const expected = 'title:Report\trows[2]{id\tval}:\n\t1\ta\n\t2\tb';
        expect(encode(input)).toBe(expected);
    });
});
