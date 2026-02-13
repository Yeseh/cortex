import { describe, expect, it } from 'bun:test';

import {
    serialize,
    deserialize,
    parseYaml,
    stringifyYaml,
    parseJson,
    stringifyJson,
    type OutputFormat,
} from './serialization.ts';

// -----------------------------------------------------------------------------
// serialize() tests
// -----------------------------------------------------------------------------

describe('serialize()', () => {
    describe('JSON format', () => {
        it('should serialize object to JSON format', () => {
            const obj = { name: 'test', value: 42 };

            const result = serialize(obj, 'json');

            expect(result).toBe('{"name":"test","value":42}');
        });

        it('should serialize nested objects to JSON', () => {
            const obj = { outer: { inner: { deep: 'value' } } };

            const result = serialize(obj, 'json');

            expect(result).toBe('{"outer":{"inner":{"deep":"value"}}}');
        });

        it('should serialize arrays to JSON', () => {
            const obj = { items: [
                1,
                2,
                3,
            ] };

            const result = serialize(obj, 'json');

            expect(result).toBe('{"items":[1,2,3]}');
        });

        it('should serialize null values to JSON', () => {
            const obj = { nullable: null };

            const result = serialize(obj, 'json');

            expect(result).toBe('{"nullable":null}');
        });
    });

    describe('YAML format', () => {
        it('should serialize object to YAML format', () => {
            const obj = { name: 'test', value: 42 };

            const result = serialize(obj, 'yaml');

            expect(result).toContain('name: test');
            expect(result).toContain('value: 42');
        });

        it('should serialize nested objects to YAML', () => {
            const obj = { outer: { inner: 'value' } };

            const result = serialize(obj, 'yaml');

            expect(result).toContain('outer:');
            expect(result).toContain('inner: value');
        });

        it('should serialize arrays to YAML', () => {
            const obj = { items: [
                'a',
                'b',
                'c',
            ] };

            const result = serialize(obj, 'yaml');

            expect(result).toContain('items:');
            expect(result).toContain('- a');
            expect(result).toContain('- b');
            expect(result).toContain('- c');
        });
    });

    describe('TOON format', () => {
        it('should serialize object to TOON format', () => {
            const obj = { name: 'test' };

            const result = serialize(obj, 'toon');

            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should serialize nested objects to TOON format', () => {
            const obj = { outer: { inner: 'value' } };

            const result = serialize(obj, 'toon');

            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('unsupported format', () => {
        it('should throw on unsupported format', () => {
            const obj = { name: 'test' };

            expect(() => serialize(obj, 'xml' as OutputFormat)).toThrow(
                'Unsupported output format: xml',
            );
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

            expect(result.name).toBe('test');
            expect(result.value).toBe(42);
        });

        it('should deserialize nested JSON objects', () => {
            const raw = '{"outer":{"inner":"value"}}';

            const result = deserialize<{ outer: { inner: string } }>(raw, 'json');

            expect(result.outer.inner).toBe('value');
        });

        it('should throw on invalid JSON', () => {
            const raw = '{invalid json}';

            expect(() => deserialize(raw, 'json')).toThrow();
        });

        it('should throw on truncated JSON', () => {
            const raw = '{"name":"test"';

            expect(() => deserialize(raw, 'json')).toThrow();
        });
    });

    describe('YAML format', () => {
        it('should deserialize YAML string to object', () => {
            const raw = 'name: test\nvalue: 42';

            const result = deserialize<{ name: string; value: number }>(raw, 'yaml');

            expect(result.name).toBe('test');
            expect(result.value).toBe(42);
        });

        it('should deserialize nested YAML objects', () => {
            const raw = 'outer:\n  inner: value';

            const result = deserialize<{ outer: { inner: string } }>(raw, 'yaml');

            expect(result.outer.inner).toBe('value');
        });

        it('should throw on invalid YAML', () => {
            const raw = '::invalid: yaml: ::';

            expect(() => deserialize(raw, 'yaml')).toThrow();
        });
    });

    describe('unsupported format', () => {
        it('should throw on unsupported format', () => {
            const raw = '<xml>test</xml>';

            expect(() => deserialize(raw, 'xml' as 'json' | 'yaml')).toThrow(
                'Unsupported input format: xml',
            );
        });
    });
});

// -----------------------------------------------------------------------------
// parseYaml() Result wrapper tests
// -----------------------------------------------------------------------------

describe('parseYaml()', () => {
    it('should parse valid YAML and return ok result', () => {
        const raw = 'name: test\nvalue: 42';

        const result = parseYaml<{ name: string; value: number }>(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.name).toBe('test');
            expect(result.value.value).toBe(42);
        }
    });

    it('should parse invalid YAML and return error with PARSE_FAILED code', () => {
        const raw = '::invalid: yaml: ::';

        const result = parseYaml(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('PARSE_FAILED');
            expect(result.error.message).toBe('Failed to parse YAML.');
            expect(result.error.cause).toBeDefined();
        }
    });

    it('should parse complex nested YAML', () => {
        const raw = [
            'config:',
            '  database:',
            '    host: localhost',
            '    port: 5432',
            '  features:',
            '    enabled: true',
        ].join('\n');

        const result = parseYaml<{
            config: {
                database: { host: string; port: number };
                features: { enabled: boolean };
            };
        }>(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.config.database.host).toBe('localhost');
            expect(result.value.config.database.port).toBe(5432);
            expect(result.value.config.features.enabled).toBe(true);
        }
    });

    it('should parse YAML with arrays', () => {
        const raw = [
            'items:',
            '  - first',
            '  - second',
            '  - third',
            'numbers:',
            '  - 1',
            '  - 2',
            '  - 3',
        ].join('\n');

        const result = parseYaml<{ items: string[]; numbers: number[] }>(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.items).toEqual([
                'first',
                'second',
                'third',
            ]);
            expect(result.value.numbers).toEqual([
                1,
                2,
                3,
            ]);
        }
    });

    it('should parse empty YAML', () => {
        const raw = '';

        const result = parseYaml(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBeNull();
        }
    });

    it('should parse YAML with inline arrays', () => {
        const raw = 'tags: [a, b, c]';

        const result = parseYaml<{ tags: string[] }>(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.tags).toEqual([
                'a',
                'b',
                'c',
            ]);
        }
    });
});

// -----------------------------------------------------------------------------
// stringifyYaml() Result wrapper tests
// -----------------------------------------------------------------------------

describe('stringifyYaml()', () => {
    it('should stringify object and return ok result', () => {
        const obj = { name: 'test', value: 42 };

        const result = stringifyYaml(obj);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('name: test');
            expect(result.value).toContain('value: 42');
        }
    });

    it('should stringify undefined values', () => {
        const obj = { defined: 'value', undefined: undefined };

        const result = stringifyYaml(obj);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('defined: value');
        }
    });

    it('should stringify null values', () => {
        const obj = { nullable: null };

        const result = stringifyYaml(obj);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('nullable: null');
        }
    });

    it('should stringify arrays', () => {
        const obj = { items: [
            'a',
            'b',
            'c',
        ] };

        const result = stringifyYaml(obj);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('items:');
        }
    });

    it('should stringify empty object', () => {
        const obj = {};

        const result = stringifyYaml(obj);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBe('{}\n');
        }
    });
});

// -----------------------------------------------------------------------------
// parseJson() Result wrapper tests
// -----------------------------------------------------------------------------

describe('parseJson()', () => {
    it('should parse valid JSON and return ok result', () => {
        const raw = '{"name":"test","value":42}';

        const result = parseJson<{ name: string; value: number }>(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.name).toBe('test');
            expect(result.value.value).toBe(42);
        }
    });

    it('should parse invalid JSON and return error with PARSE_FAILED code', () => {
        const raw = '{invalid json}';

        const result = parseJson(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('PARSE_FAILED');
            expect(result.error.message).toBe('Failed to parse JSON.');
            expect(result.error.cause).toBeDefined();
        }
    });

    it('should parse JSON arrays', () => {
        const raw = '[1,2,3]';

        const result = parseJson<number[]>(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual([
                1,
                2,
                3,
            ]);
        }
    });

    it('should parse JSON strings', () => {
        const raw = '"hello"';

        const result = parseJson<string>(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBe('hello');
        }
    });

    it('should return error for truncated JSON', () => {
        const raw = '{"name":"test"';

        const result = parseJson(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('PARSE_FAILED');
        }
    });

    it('should return error for empty string', () => {
        const raw = '';

        const result = parseJson(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('PARSE_FAILED');
        }
    });
});

// -----------------------------------------------------------------------------
// stringifyJson() Result wrapper tests
// -----------------------------------------------------------------------------

describe('stringifyJson()', () => {
    it('should stringify object and return ok result', () => {
        const obj = { name: 'test', value: 42 };

        const result = stringifyJson(obj);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBe('{"name":"test","value":42}');
        }
    });

    it('should stringify arrays', () => {
        const obj = [
            1,
            2,
            3,
        ];

        const result = stringifyJson(obj);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBe('[1,2,3]');
        }
    });

    it('should stringify null values', () => {
        const obj = { nullable: null };

        const result = stringifyJson(obj);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toBe('{"nullable":null}');
        }
    });

    it('should return error for circular references', () => {
        const obj: Record<string, unknown> = { name: 'test' };
        obj.self = obj; // Create circular reference

        const result = stringifyJson(obj);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('SERIALIZE_FAILED');
            expect(result.error.message).toBe('Failed to serialize to JSON.');
            expect(result.error.cause).toBeDefined();
        }
    });

    it('should stringify primitives', () => {
        const helloResult = stringifyJson('hello');
        expect(helloResult.ok).toBe(true);
        if (helloResult.ok) {
            expect(helloResult.value).toBe('"hello"');
        }

        const numberResult = stringifyJson(42);
        expect(numberResult.ok).toBe(true);
        if (numberResult.ok) {
            expect(numberResult.value).toBe('42');
        }

        const boolResult = stringifyJson(true);
        expect(boolResult.ok).toBe(true);
        if (boolResult.ok) {
            expect(boolResult.value).toBe('true');
        }

        const nullResult = stringifyJson(null);
        expect(nullResult.ok).toBe(true);
        if (nullResult.ok) {
            expect(nullResult.value).toBe('null');
        }
    });
});


// -----------------------------------------------------------------------------
// Edge cases and integration tests
// -----------------------------------------------------------------------------

describe('serialization edge cases', () => {
    it('should handle special characters in YAML strings', () => {
        const obj = { text: 'Contains: colons and "quotes"' };

        const yamlResult = stringifyYaml(obj);
        expect(yamlResult.ok).toBe(true);
        if (yamlResult.ok) {
            const parsed = parseYaml<{ text: string }>(yamlResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.text).toBe('Contains: colons and "quotes"');
            }
        }
    });

    it('should handle multiline strings in YAML', () => {
        const obj = { text: 'Line 1\nLine 2\nLine 3' };

        const yamlResult = stringifyYaml(obj);
        expect(yamlResult.ok).toBe(true);
        if (yamlResult.ok) {
            const parsed = parseYaml<{ text: string }>(yamlResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.text).toBe('Line 1\nLine 2\nLine 3');
            }
        }
    });

    it('should handle Unicode characters', () => {
        const obj = { emoji: '🔥 Fire emoji', japanese: 'こんにちは' };

        const jsonResult = stringifyJson(obj);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const parsed = parseJson<typeof obj>(jsonResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.emoji).toBe('🔥 Fire emoji');
                expect(parsed.value.japanese).toBe('こんにちは');
            }
        }
    });

    it('should handle boolean values consistently', () => {
        const obj = { enabled: true, disabled: false };

        // Test JSON
        const jsonResult = stringifyJson(obj);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const parsed = parseJson<typeof obj>(jsonResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.enabled).toBe(true);
                expect(parsed.value.disabled).toBe(false);
            }
        }

        // Test YAML
        const yamlResult = stringifyYaml(obj);
        expect(yamlResult.ok).toBe(true);
        if (yamlResult.ok) {
            const parsed = parseYaml<typeof obj>(yamlResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.enabled).toBe(true);
                expect(parsed.value.disabled).toBe(false);
            }
        }
    });

    it('should handle numeric edge values', () => {
        const obj = { zero: 0, negative: -42, float: 3.14, large: 1000000 };

        const jsonResult = stringifyJson(obj);
        expect(jsonResult.ok).toBe(true);
        if (jsonResult.ok) {
            const parsed = parseJson<typeof obj>(jsonResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.zero).toBe(0);
                expect(parsed.value.negative).toBe(-42);
                expect(parsed.value.float).toBe(3.14);
                expect(parsed.value.large).toBe(1000000);
            }
        }
    });

    it('should handle deeply nested structures', () => {
        const obj = {
            level1: {
                level2: {
                    level3: {
                        level4: {
                            value: 'deep',
                        },
                    },
                },
            },
        };

        const yamlResult = stringifyYaml(obj);
        expect(yamlResult.ok).toBe(true);
        if (yamlResult.ok) {
            const parsed = parseYaml<typeof obj>(yamlResult.value);
            expect(parsed.ok).toBe(true);
            if (parsed.ok) {
                expect(parsed.value.level1.level2.level3.level4.value).toBe('deep');
            }
        }
    });
});
