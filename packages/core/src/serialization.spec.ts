import { describe, expect, it } from 'bun:test';

import { serialize, deserialize, type OutputFormat } from './serialization.ts';

// -----------------------------------------------------------------------------
// serialize() tests
// -----------------------------------------------------------------------------

describe('serialize()', () => {
    describe('JSON format', () => {
        it('should serialize object to JSON format', () => {
            const obj = { name: 'test', value: 42 };

            const result = serialize(obj, 'json');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe('{"name":"test","value":42}');
            }
        });

        it('should serialize nested objects to JSON', () => {
            const obj = { outer: { inner: { deep: 'value' } } };

            const result = serialize(obj, 'json');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe('{"outer":{"inner":{"deep":"value"}}}');
            }
        });

        it('should serialize arrays to JSON', () => {
            const obj = { items: [1, 2, 3] };

            const result = serialize(obj, 'json');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe('{"items":[1,2,3]}');
            }
        });

        it('should serialize null values to JSON', () => {
            const obj = { nullable: null };

            const result = serialize(obj, 'json');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toBe('{"nullable":null}');
            }
        });

        it('should return SERIALIZE_FAILED for circular references', () => {
            const obj: Record<string, unknown> = { name: 'test' };
            obj.self = obj;

            const result = serialize(obj, 'json');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('SERIALIZE_FAILED');
                expect(result.error.message).toBe('Failed to serialize to json.');
            }
        });
    });

    describe('YAML format', () => {
        it('should serialize object to YAML format', () => {
            const obj = { name: 'test', value: 42 };

            const result = serialize(obj, 'yaml');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toContain('name: test');
                expect(result.value).toContain('value: 42');
            }
        });

        it('should serialize nested objects to YAML', () => {
            const obj = { outer: { inner: 'value' } };

            const result = serialize(obj, 'yaml');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value).toContain('outer:');
                expect(result.value).toContain('inner: value');
            }
        });

        it('should serialize arrays to YAML', () => {
            const obj = { items: ['a', 'b', 'c'] };

            const result = serialize(obj, 'yaml');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                // Bun.YAML uses flow-style arrays: items: [a, b, c]
                expect(result.value).toContain('items:');
                expect(result.value).toMatch(/a/);
                expect(result.value).toMatch(/b/);
                expect(result.value).toMatch(/c/);
            }
        });
    });

    describe('TOON format', () => {
        it('should serialize object to TOON format', () => {
            const obj = { name: 'test' };

            const result = serialize(obj, 'toon');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(typeof result.value).toBe('string');
                expect(result.value.length).toBeGreaterThan(0);
            }
        });

        it('should serialize nested objects to TOON format', () => {
            const obj = { outer: { inner: 'value' } };

            const result = serialize(obj, 'toon');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(typeof result.value).toBe('string');
                expect(result.value.length).toBeGreaterThan(0);
            }
        });
    });

    describe('unsupported format', () => {
        it('should throw on unsupported format', () => {
            const obj = { name: 'test' };

            const result = serialize(obj, 'xml' as OutputFormat);

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_FORMAT');
                expect(result.error.message).toBe('Unsupported output format: xml');
            }
        });
    });
});

// -----------------------------------------------------------------------------
// deserialize() tests
// -----------------------------------------------------------------------------

describe('deserialize()', () => {
    describe('JSON format', () => {
        it('should deserialize JSON string to object', () => {
            const raw = '{"name":"test","value":42}';

            const result = deserialize<{ name: string; value: number }>(raw, 'json');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.name).toBe('test');
                expect(result.value.value).toBe(42);
            }
        });

        it('should deserialize nested JSON objects', () => {
            const raw = '{"outer":{"inner":"value"}}';

            const result = deserialize<{ outer: { inner: string } }>(raw, 'json');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.outer.inner).toBe('value');
            }
        });

        it('should throw on invalid JSON', () => {
            const raw = '{invalid json}';

            const result = deserialize(raw, 'json');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('PARSE_FAILED');
                expect(result.error.message).toBe('Failed to deserialize json.');
            }
        });

        it('should throw on truncated JSON', () => {
            const raw = '{"name":"test"';

            const result = deserialize(raw, 'json');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('PARSE_FAILED');
            }
        });
    });

    describe('YAML format', () => {
        it('should deserialize YAML string to object', () => {
            const raw = 'name: test\nvalue: 42';

            const result = deserialize<{ name: string; value: number }>(raw, 'yaml');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.name).toBe('test');
                expect(result.value.value).toBe(42);
            }
        });

        it('should deserialize nested YAML objects', () => {
            const raw = 'outer:\n  inner: value';

            const result = deserialize<{ outer: { inner: string } }>(raw, 'yaml');

            expect(result.ok()).toBe(true);
            if (result.ok()) {
                expect(result.value.outer.inner).toBe('value');
            }
        });

        it('should throw on invalid YAML', () => {
            const raw = '::invalid: yaml: ::';

            const result = deserialize(raw, 'yaml');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('PARSE_FAILED');
                expect(result.error.message).toBe('Failed to deserialize yaml.');
            }
        });
    });

    describe('TOON format', () => {
        it('should round-trip through TOON format', () => {
            const obj = { name: 'test', value: 42 };

            const encoded = serialize(obj, 'toon');
            expect(encoded.ok()).toBe(true);

            if (encoded.ok()) {
                const decoded = deserialize<typeof obj>(encoded.value, 'toon');
                expect(decoded.ok()).toBe(true);
                if (decoded.ok()) {
                    expect(decoded.value).toEqual(obj);
                }
            }
        });
    });

    describe('unsupported format', () => {
        it('should throw on unsupported format', () => {
            const raw = '<xml>test</xml>';

            const result = deserialize(raw, 'xml' as 'json' | 'yaml');

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('INVALID_FORMAT');
                expect(result.error.message).toBe('Unsupported input format: xml');
            }
        });
    });
});
