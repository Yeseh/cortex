import { describe, expect, it } from 'bun:test';

import {
    serialize,
    deserialize,
    parseYaml,
    stringifyYaml,
    parseJson,
    stringifyJson,
    parseIndex,
    serializeIndex,
    type OutputFormat,
} from './serialization.ts';
import type { CategoryIndex } from './index/types.ts';

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
// parseIndex() tests
// -----------------------------------------------------------------------------

describe('parseIndex()', () => {
    it('should parse valid category index YAML', () => {
        const raw = [
            'memories:',
            '  - path: working/preferences',
            '    token_estimate: 100',
            'subcategories:',
            '  - path: semantic/concepts',
            '    memory_count: 5',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories).toHaveLength(1);
            expect(result.value.subcategories).toHaveLength(1);
        }
    });

    it('should validate snake_case to camelCase conversion (token_estimate -> tokenEstimate)', () => {
        const raw = [
            'memories:',
            '  - path: my-memory',
            '    token_estimate: 42',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories[0]?.tokenEstimate).toBe(42);
            expect(
                (result.value.memories[0] as unknown as Record<string, unknown>)['token_estimate'],
            ).toBeUndefined();
        }
    });

    it('should validate snake_case to camelCase conversion (memory_count -> memoryCount)', () => {
        const raw = [
            'memories: []',
            'subcategories:',
            '  - path: projects/cortex',
            '    memory_count: 10',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.subcategories[0]?.memoryCount).toBe(10);
            expect(
                (result.value.subcategories[0] as unknown as Record<string, unknown>)[
                    'memory_count'
                ],
            ).toBeUndefined();
        }
    });

    it('should parse index with empty memories array', () => {
        const raw = [
            'memories: []',
            'subcategories:',
            '  - path: semantic/concepts',
            '    memory_count: 3',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories).toEqual([]);
            expect(result.value.subcategories).toHaveLength(1);
        }
    });

    it('should parse index with empty subcategories array', () => {
        const raw = [
            'memories:',
            '  - path: working/notes',
            '    token_estimate: 50',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories).toHaveLength(1);
            expect(result.value.subcategories).toEqual([]);
        }
    });

    it('should parse index with optional summary field', () => {
        const raw = [
            'memories:',
            '  - path: working/preferences',
            '    token_estimate: 100',
            '    summary: User preference settings',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories[0]?.summary).toBe('User preference settings');
        }
    });

    it('should parse index with optional description field', () => {
        const raw = [
            'memories: []',
            'subcategories:',
            '  - path: projects/cortex',
            '    memory_count: 5',
            '    description: Cortex memory system project knowledge',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.subcategories[0]?.description).toBe(
                'Cortex memory system project knowledge',
            );
        }
    });

    it('should parse index with optional updatedAt field', () => {
        const raw = [
            'memories:',
            '  - path: working/preferences',
            '    token_estimate: 100',
            '    updated_at: 2024-01-15T10:30:00.000Z',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories[0]?.updatedAt).toBeInstanceOf(Date);
            expect(result.value.memories[0]?.updatedAt?.toISOString()).toBe('2024-01-15T10:30:00.000Z');
        }
    });

    it('should parse index without updatedAt field (backward compatibility)', () => {
        const raw = [
            'memories:',
            '  - path: working/notes',
            '    token_estimate: 50',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.memories[0]?.updatedAt).toBeUndefined();
        }
    });

    it('should return VALIDATION_FAILED for missing memories field', () => {
        const raw = [
            'subcategories:',
            '  - path: semantic/concepts',
            '    memory_count: 3',
        ].join(
            '\n',
        );

        const result = parseIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('VALIDATION_FAILED');
            expect(result.error.message).toBe('Invalid category index format.');
        }
    });

    it('should return VALIDATION_FAILED for missing subcategories field', () => {
        const raw = [
            'memories:',
            '  - path: working/notes',
            '    token_estimate: 50',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('VALIDATION_FAILED');
        }
    });

    it('should return VALIDATION_FAILED for missing path in memory entry', () => {
        const raw = [
            'memories:',
            '  - token_estimate: 100',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('VALIDATION_FAILED');
        }
    });

    it('should return VALIDATION_FAILED for missing token_estimate in memory entry', () => {
        const raw = [
            'memories:',
            '  - path: working/notes',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('VALIDATION_FAILED');
        }
    });

    it('should return VALIDATION_FAILED for invalid field types', () => {
        const raw = [
            'memories:',
            '  - path: working/notes',
            '    token_estimate: not-a-number',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('VALIDATION_FAILED');
        }
    });

    it('should return VALIDATION_FAILED for negative token_estimate', () => {
        const raw = [
            'memories:',
            '  - path: working/notes',
            '    token_estimate: -5',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('VALIDATION_FAILED');
        }
    });

    it('should return VALIDATION_FAILED for empty path string', () => {
        const raw = [
            'memories:',
            '  - path: ""',
            '    token_estimate: 100',
            'subcategories: []',
        ].join('\n');

        const result = parseIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('VALIDATION_FAILED');
        }
    });

    it('should return PARSE_FAILED for invalid YAML syntax', () => {
        const raw = '::invalid: yaml: ::';

        const result = parseIndex(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('PARSE_FAILED');
        }
    });
});

// -----------------------------------------------------------------------------
// serializeIndex() tests
// -----------------------------------------------------------------------------

describe('serializeIndex()', () => {
    it('should serialize CategoryIndex to YAML', () => {
        const index: CategoryIndex = {
            memories: [{ path: 'working/notes', tokenEstimate: 100 }],
            subcategories: [{ path: 'semantic/concepts', memoryCount: 5 }],
        };

        const result = serializeIndex(index);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('memories:');
            expect(result.value).toContain('subcategories:');
        }
    });

    it('should validate camelCase to snake_case conversion (tokenEstimate -> token_estimate)', () => {
        const index: CategoryIndex = {
            memories: [{ path: 'my-memory', tokenEstimate: 42 }],
            subcategories: [],
        };

        const result = serializeIndex(index);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('token_estimate: 42');
            expect(result.value).not.toContain('tokenEstimate');
        }
    });

    it('should validate camelCase to snake_case conversion (memoryCount -> memory_count)', () => {
        const index: CategoryIndex = {
            memories: [],
            subcategories: [{ path: 'projects/cortex', memoryCount: 10 }],
        };

        const result = serializeIndex(index);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('memory_count: 10');
            expect(result.value).not.toContain('memoryCount');
        }
    });

    it('should serialize with optional fields present', () => {
        const index: CategoryIndex = {
            memories: [{ path: 'working/preferences', tokenEstimate: 100, summary: 'User preferences' }],
            subcategories: [{
                path: 'projects/cortex',
                memoryCount: 5,
                description: 'Project knowledge',
            }],
        };

        const result = serializeIndex(index);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('summary: User preferences');
            expect(result.value).toContain('description: Project knowledge');
        }
    });

    it('should serialize with optional fields absent', () => {
        const index: CategoryIndex = {
            memories: [{ path: 'working/notes', tokenEstimate: 50 }],
            subcategories: [{ path: 'semantic/concepts', memoryCount: 3 }],
        };

        const result = serializeIndex(index);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).not.toContain('summary:');
            expect(result.value).not.toContain('description:');
            expect(result.value).not.toContain('updated_at:');
        }
    });

    it('should serialize with updatedAt field present', () => {
        const testDate = new Date('2024-01-15T10:30:00.000Z');
        const index: CategoryIndex = {
            memories: [{ path: 'working/notes', tokenEstimate: 50, updatedAt: testDate }],
            subcategories: [],
        };

        const result = serializeIndex(index);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('updated_at: 2024-01-15T10:30:00.000Z');
            expect(result.value).not.toContain('updatedAt');
        }
    });

    it('should serialize without updatedAt field when absent', () => {
        const index: CategoryIndex = {
            memories: [{ path: 'working/notes', tokenEstimate: 50 }],
            subcategories: [],
        };

        const result = serializeIndex(index);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).not.toContain('updated_at:');
        }
    });

    it('should serialize empty memories array', () => {
        const index: CategoryIndex = {
            memories: [],
            subcategories: [{ path: 'semantic/concepts', memoryCount: 3 }],
        };

        const result = serializeIndex(index);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('memories: []');
        }
    });

    it('should serialize empty subcategories array', () => {
        const index: CategoryIndex = {
            memories: [{ path: 'working/notes', tokenEstimate: 50 }],
            subcategories: [],
        };

        const result = serializeIndex(index);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('subcategories: []');
        }
    });

    it('should round-trip: serialize then parse should equal original', () => {
        const originalIndex: CategoryIndex = {
            memories: [
                { path: 'working/preferences', tokenEstimate: 100, summary: 'User preferences' },
                { path: 'working/notes', tokenEstimate: 50 },
            ],
            subcategories: [
                {
                    path: 'projects/cortex',
                    memoryCount: 5,
                    description: 'Cortex project knowledge',
                },
                { path: 'semantic/concepts', memoryCount: 3 },
            ],
        };

        const serialized = serializeIndex(originalIndex);
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
            return;
        }

        const parsed = parseIndex(serialized.value);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.value).toEqual(originalIndex);
        }
    });

    it('should round-trip with empty arrays', () => {
        const originalIndex: CategoryIndex = {
            memories: [],
            subcategories: [],
        };

        const serialized = serializeIndex(originalIndex);
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
            return;
        }

        const parsed = parseIndex(serialized.value);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.value).toEqual(originalIndex);
        }
    });

    it('should round-trip complex index with multiple entries', () => {
        const originalIndex: CategoryIndex = {
            memories: [
                { path: 'a', tokenEstimate: 1 },
                { path: 'b', tokenEstimate: 2, summary: 'Summary B' },
                { path: 'c', tokenEstimate: 3 },
            ],
            subcategories: [
                { path: 'x', memoryCount: 10, description: 'Category X' },
                { path: 'y', memoryCount: 20 },
                { path: 'z', memoryCount: 30, description: 'Category Z' },
            ],
        };

        const serialized = serializeIndex(originalIndex);
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
            return;
        }

        const parsed = parseIndex(serialized.value);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.value).toEqual(originalIndex);
        }
    });

    it('should round-trip with updatedAt field present', () => {
        const testDate = new Date('2024-01-15T10:30:00.000Z');
        const originalIndex: CategoryIndex = {
            memories: [
                { path: 'recent/note', tokenEstimate: 100, updatedAt: testDate },
                { path: 'old/note', tokenEstimate: 50 },
            ],
            subcategories: [],
        };

        const serialized = serializeIndex(originalIndex);
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
            return;
        }

        const parsed = parseIndex(serialized.value);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.value).toEqual(originalIndex);
        }
    });

    it('should round-trip with mixed updatedAt presence', () => {
        const date1 = new Date('2024-01-15T10:30:00.000Z');
        const date2 = new Date('2024-02-20T14:45:00.000Z');
        const originalIndex: CategoryIndex = {
            memories: [
                { path: 'a', tokenEstimate: 1, updatedAt: date1 },
                { path: 'b', tokenEstimate: 2 },
                { path: 'c', tokenEstimate: 3, updatedAt: date2, summary: 'Has summary' },
            ],
            subcategories: [],
        };

        const serialized = serializeIndex(originalIndex);
        expect(serialized.ok).toBe(true);
        if (!serialized.ok) {
            return;
        }

        const parsed = parseIndex(serialized.value);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.value).toEqual(originalIndex);
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
