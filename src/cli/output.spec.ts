import { describe, expect, test } from 'bun:test';
import { serializeOutput } from './output.ts';
import type {
    OutputCategory,
    OutputInit,
    OutputMemory,
    OutputStore,
    OutputStoreInit,
    OutputStoreRegistry,
} from './output.ts';

// Sample test data
const sampleMemory: OutputMemory = {
    path: 'global/persona/test-memory',
    metadata: {
        createdAt: new Date('2024-01-15T10:00:00Z'),
        updatedAt: new Date('2024-01-16T14:30:00Z'),
        tags: ['test', 'example'],
        source: 'unit-test',
        tokenEstimate: 42,
    },
    content: 'This is test content.',
};

const sampleCategory: OutputCategory = {
    path: 'global/persona',
    memories: [
        { path: 'global/persona/mem1', tokenEstimate: 10, summary: 'First memory' },
        { path: 'global/persona/mem2', tokenEstimate: 20 },
    ],
    subcategories: [{ path: 'global/persona/sub1', memoryCount: 5 }],
};

// Helper to serialize with TOON format
const toonSerialize = <T>(kind: string, value: T) =>
    serializeOutput({ kind, value } as Parameters<typeof serializeOutput>[0], 'toon');

describe('serializeMemoryToon', () => {
    test('encodes memory with all metadata fields', () => {
        const result = toonSerialize('memory', sampleMemory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // TOON outputs YAML-like format with spaces after colons and nested structure
            expect(result.value).toContain('path: global/persona/test-memory');
            // Timestamps are quoted because they contain colons, nested under metadata
            expect(result.value).toContain('createdAt: "2024-01-15T10:00:00.000Z"');
            expect(result.value).toContain('updatedAt: "2024-01-16T14:30:00.000Z"');
            expect(result.value).toContain('tags[2');
            expect(result.value).toContain('source: unit-test');
            expect(result.value).toContain('tokenEstimate: 42');
            expect(result.value).toContain('content: This is test content.');
        }
    });

    test('uses nested structure for metadata (not key folding)', () => {
        const memory: OutputMemory = {
            path: 'test/path',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: ['tag1'],
            },
            content: 'Content',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // TOON produces nested YAML-like structure, not dotted notation
            expect(result.value).toContain('metadata:');
            expect(result.value).toContain('createdAt:');
            expect(result.value).toContain('tags[1');
        }
    });

    test('quotes multiline content', () => {
        const memory: OutputMemory = {
            path: 'test/multiline',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
            },
            content: 'Line 1\nLine 2\nLine 3',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Multiline content should be quoted (JSON-style)
            expect(result.value).toContain('"Line 1\\nLine 2\\nLine 3"');
        }
    });

    test('handles missing optional fields (updatedAt, source, tokenEstimate, expiresAt)', () => {
        const memory: OutputMemory = {
            path: 'test/minimal',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: ['minimal'],
                // No updatedAt, source, tokenEstimate, expiresAt
            },
            content: 'Minimal content',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('path: test/minimal');
            expect(result.value).toContain('createdAt:');
            expect(result.value).toContain('content: Minimal content');
            // Should NOT contain optional fields that weren't set
            expect(result.value).not.toContain('updatedAt');
            expect(result.value).not.toContain('source');
            expect(result.value).not.toContain('tokenEstimate');
            expect(result.value).not.toContain('expiresAt');
        }
    });

    test('serializes whitespace path without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const memory: OutputMemory = {
            path: '   ', // Whitespace path - serializes as-is
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
            },
            content: 'Content',
        };
        const result = toonSerialize('memory', memory);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('path:');
        }
    });

    test('serializes Invalid Date as SERIALIZE_FAILED', () => {
        const memory: OutputMemory = {
            path: 'test/path',
            metadata: {
                createdAt: new Date('invalid date'),
                tags: [],
            },
            content: 'Content',
        };
        const result = toonSerialize('memory', memory);

        // Invalid Date causes serialization to fail
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('SERIALIZE_FAILED');
        }
    });
});

describe('serializeCategoryToon', () => {
    test('encodes category with memories and subcategories', () => {
        const result = toonSerialize('category', sampleCategory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('path: global/persona');
            // Memories array with TOON array format
            expect(result.value).toContain('memories[2');
            // Subcategories use tabular format
            expect(result.value).toContain('subcategories[1');
        }
    });

    test('uses tabular format for uniform memories array', () => {
        // Create a uniform array (all items have same keys)
        const category: OutputCategory = {
            path: 'test/uniform-memories',
            memories: [
                { path: 'test/mem1', tokenEstimate: 10 },
                { path: 'test/mem2', tokenEstimate: 20 },
            ],
            subcategories: [],
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Tabular format with tab-separated header
            expect(result.value).toMatch(/memories\[2\t\]\{path\ttokenEstimate\}:/);
            // Should contain memory paths in the rows
            expect(result.value).toContain('test/mem1');
            expect(result.value).toContain('test/mem2');
        }
    });

    test('uses tabular format for subcategories array', () => {
        const result = toonSerialize('category', sampleCategory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Tabular format for subcategories with tab-separated format
            expect(result.value).toMatch(/subcategories\[1\t\]\{path\tmemoryCount\}:/);
            expect(result.value).toContain('global/persona/sub1');
            expect(result.value).toContain('5'); // memory count
        }
    });

    test('handles empty memories array', () => {
        const category: OutputCategory = {
            path: 'test/empty-memories',
            memories: [],
            subcategories: [{ path: 'test/sub', memoryCount: 3 }],
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Empty arrays in TOON format show count of 0
            expect(result.value).toContain('memories[0');
        }
    });

    test('handles empty subcategories array', () => {
        const category: OutputCategory = {
            path: 'test/empty-subcategories',
            memories: [{ path: 'test/mem1', tokenEstimate: 10 }],
            subcategories: [],
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Empty arrays in TOON format show count of 0
            expect(result.value).toContain('subcategories[0');
        }
    });

    test('serializes empty path without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const category: OutputCategory = {
            path: '', // Empty path - serializes as-is
            memories: [],
            subcategories: [],
        };
        const result = toonSerialize('category', category);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
    });
});

describe('serializeStoreToon', () => {
    test('encodes store with name and path', () => {
        const store: OutputStore = {
            name: 'my-store',
            path: '/data/my-store',
        };
        const result = toonSerialize('store', store);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // TOON outputs YAML-like format with spaces after colons
            expect(result.value).toContain('name: my-store');
            expect(result.value).toContain('path: /data/my-store');
        }
    });

    test('serializes invalid store name without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const store: OutputStore = {
            name: 'Invalid Name!', // Not lowercase slug - serializes as-is
            path: '/data/store',
        };
        const result = toonSerialize('store', store);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('name: Invalid Name!');
        }
    });

    test('serializes whitespace store path without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const store: OutputStore = {
            name: 'valid-name',
            path: '   ', // Whitespace path - serializes as-is
        };
        const result = toonSerialize('store', store);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
    });
});

describe('serializeStoreRegistryToon', () => {
    test('encodes registry with multiple stores', () => {
        const registry: OutputStoreRegistry = {
            stores: [
                { name: 'store-one', path: '/data/one' },
                { name: 'store-two', path: '/data/two' },
            ],
        };
        const result = toonSerialize('store-registry', registry);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('stores[2');
            expect(result.value).toContain('store-one');
            expect(result.value).toContain('store-two');
        }
    });

    test('uses tabular format for stores array', () => {
        const registry: OutputStoreRegistry = {
            stores: [
                { name: 'alpha', path: '/a' },
                { name: 'beta', path: '/b' },
            ],
        };
        const result = toonSerialize('store-registry', registry);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Tabular format: header with count and field names (tab-separated)
            expect(result.value).toMatch(/stores\[2\t\]\{name\tpath\}:/);
        }
    });

    test('handles empty stores array', () => {
        const registry: OutputStoreRegistry = {
            stores: [],
        };
        const result = toonSerialize('store-registry', registry);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Empty arrays in TOON format show count of 0
            expect(result.value).toContain('stores[0');
        }
    });

    test('serializes invalid store in array without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const registry: OutputStoreRegistry = {
            stores: [
                { name: 'valid-store', path: '/valid' },
                { name: 'INVALID STORE', path: '/invalid' }, // Invalid name - serializes as-is
            ],
        };
        const result = toonSerialize('store-registry', registry);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('INVALID STORE');
        }
    });
});

describe('serializeStoreInitToon', () => {
    test('encodes store init with path', () => {
        const storeInit: OutputStoreInit = {
            path: '/initialized/store/path',
        };
        const result = toonSerialize('store-init', storeInit);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // TOON outputs YAML-like format with spaces after colons
            expect(result.value).toContain('path: /initialized/store/path');
        }
    });

    test('serializes empty path without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const storeInit: OutputStoreInit = {
            path: '',
        };
        const result = toonSerialize('store-init', storeInit);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
    });
});

describe('serializeInitToon', () => {
    test('encodes init with path and categories', () => {
        const init: OutputInit = {
            path: '/project/root',
            categories: ['persona', 'project', 'domain'],
        };
        const result = toonSerialize('init', init);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // TOON outputs YAML-like format with spaces after colons
            expect(result.value).toContain('path: /project/root');
            expect(result.value).toContain('categories[3');
            // Categories array
            expect(result.value).toContain('persona');
            expect(result.value).toContain('project');
            expect(result.value).toContain('domain');
        }
    });

    test('handles empty categories array', () => {
        const init: OutputInit = {
            path: '/project/empty',
            categories: [],
        };
        const result = toonSerialize('init', init);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('path: /project/empty');
            // Empty arrays in TOON format show count of 0
            expect(result.value).toContain('categories[0');
        }
    });

    test('serializes whitespace path without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const init: OutputInit = {
            path: '   ',
            categories: ['test'],
        };
        const result = toonSerialize('init', init);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
    });
});

describe('TOON edge cases', () => {
    test('handles special characters in content', () => {
        const memory: OutputMemory = {
            path: 'test/special-chars',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
            },
            content: 'Content with "quotes" and : colons',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Content with special chars should be quoted
            expect(result.value).toContain('"Content with \\"quotes\\" and : colons"');
        }
    });

    test('handles tab characters in strings', () => {
        const memory: OutputMemory = {
            path: 'test/tabs',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
            },
            content: 'Column1\tColumn2\tColumn3',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Tab characters should be quoted/escaped
            expect(result.value).toContain('"Column1\\tColumn2\\tColumn3"');
        }
    });

    test('handles newlines in strings', () => {
        const memory: OutputMemory = {
            path: 'test/newlines',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
            },
            content: 'First line\r\nSecond line',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Newlines should be quoted/escaped
            expect(result.value).toContain('\\r\\n');
        }
    });

    test('handles empty strings', () => {
        const memory: OutputMemory = {
            path: 'test/empty-content',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
            },
            content: '',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Empty content should be represented
            expect(result.value).toContain('content:');
        }
    });

    test('handles unicode characters', () => {
        const memory: OutputMemory = {
            path: 'test/unicode',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: ['emoji', 'unicode'],
            },
            content: 'Hello, world! Bonjour! Hola!',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('Hello, world! Bonjour! Hola!');
        }
    });

    test('handles memory with expiresAt field', () => {
        const memory: OutputMemory = {
            path: 'test/expires',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
                expiresAt: new Date('2025-01-15T10:00:00Z'),
            },
            content: 'Expiring content',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Timestamps are quoted, nested under metadata (not dotted)
            expect(result.value).toContain('expiresAt: "2025-01-15T10:00:00.000Z"');
        }
    });

    test('handles category memory with summary containing special characters', () => {
        const category: OutputCategory = {
            path: 'test/special-summary',
            memories: [
                {
                    path: 'test/mem1',
                    tokenEstimate: 10,
                    summary: 'Summary with "quotes" and: colons',
                },
            ],
            subcategories: [],
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Summary with special chars should be quoted
            expect(result.value).toContain('Summary with');
        }
    });

    test('handles tags array in memory', () => {
        const memory: OutputMemory = {
            path: 'test/tags',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: ['tag1', 'tag-two', 'tag_three'],
            },
            content: 'Tagged content',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Nested tags under metadata
            expect(result.value).toContain('tags[3');
            expect(result.value).toContain('tag1');
            expect(result.value).toContain('tag-two');
            expect(result.value).toContain('tag_three');
        }
    });

    test('handles empty tags array', () => {
        const memory: OutputMemory = {
            path: 'test/no-tags',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
            },
            content: 'No tags content',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Empty tags array in TOON format shows count of 0
            expect(result.value).toContain('tags[0');
        }
    });

    test('handles large token estimate values', () => {
        const memory: OutputMemory = {
            path: 'test/large-tokens',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
                tokenEstimate: 999999,
            },
            content: 'Large token estimate',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Nested under metadata (not dotted)
            expect(result.value).toContain('tokenEstimate: 999999');
        }
    });

    test('serializes negative token estimate without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const memory: OutputMemory = {
            path: 'test/negative-tokens',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
                tokenEstimate: -5,
            },
            content: 'Invalid token estimate',
        };
        const result = toonSerialize('memory', memory);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('-5');
        }
    });

    test('serializes Infinity token estimate without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const memory: OutputMemory = {
            path: 'test/infinite-tokens',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
                tokenEstimate: Number.POSITIVE_INFINITY,
            },
            content: 'Infinite token estimate',
        };
        const result = toonSerialize('memory', memory);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
    });

    test('serializes invalid updatedAt date as SERIALIZE_FAILED', () => {
        const memory: OutputMemory = {
            path: 'test/invalid-updated',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                updatedAt: new Date('not a date'),
                tags: [],
            },
            content: 'Invalid updated date',
        };
        const result = toonSerialize('memory', memory);

        // Invalid Date causes serialization to fail
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('SERIALIZE_FAILED');
        }
    });

    test('serializes invalid expiresAt date as SERIALIZE_FAILED', () => {
        const memory: OutputMemory = {
            path: 'test/invalid-expires',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
                expiresAt: new Date('invalid'),
            },
            content: 'Invalid expires date',
        };
        const result = toonSerialize('memory', memory);

        // Invalid Date causes serialization to fail
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('SERIALIZE_FAILED');
        }
    });

    test('handles subcategory with zero memory count', () => {
        const category: OutputCategory = {
            path: 'test/zero-count',
            memories: [],
            subcategories: [{ path: 'test/empty-sub', memoryCount: 0 }],
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('test/empty-sub');
            expect(result.value).toContain('0');
        }
    });

    test('serializes negative memory count without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const category: OutputCategory = {
            path: 'test/negative-count',
            memories: [],
            subcategories: [{ path: 'test/invalid-sub', memoryCount: -1 }],
        };
        const result = toonSerialize('category', category);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('-1');
        }
    });

    test('serializes whitespace memory path in category without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const category: OutputCategory = {
            path: 'test/valid-path',
            memories: [{ path: '   ', tokenEstimate: 10 }], // Whitespace path - serializes as-is
            subcategories: [],
        };
        const result = toonSerialize('category', category);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
    });

    test('serializes empty subcategory path without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const category: OutputCategory = {
            path: 'test/valid-path',
            memories: [],
            subcategories: [{ path: '', memoryCount: 5 }], // Empty path - serializes as-is
        };
        const result = toonSerialize('category', category);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
    });

    test('serializes negative token estimate in category memory without error (no validation)', () => {
        // The output module does NOT validate - it just serializes
        const category: OutputCategory = {
            path: 'test/valid-path',
            memories: [{ path: 'test/mem', tokenEstimate: -10 }],
            subcategories: [],
        };
        const result = toonSerialize('category', category);

        // Serialization succeeds - validation is at object construction time
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('-10');
        }
    });
});

describe('TOON format output structure', () => {
    test('output uses newlines between top-level key-value pairs', () => {
        const store: OutputStore = {
            name: 'test-store',
            path: '/test/path',
        };
        const result = toonSerialize('store', store);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Newline between fields for YAML-like output
            expect(result.value).toContain('\n');
            expect(result.value).toContain('name: test-store');
            expect(result.value).toContain('path: /test/path');
        }
    });

    test('output uses nested structure for metadata (not key folding)', () => {
        const memory: OutputMemory = {
            path: 'test/folding',
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: ['test'],
            },
            content: 'Test folding',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // TOON outputs nested YAML-like format, not inline object braces
            expect(result.value).not.toMatch(/metadata:\{/);
            // Should have nested indented structure
            expect(result.value).toContain('metadata:');
        }
    });

    test('tabular format uses correct header syntax with tab separators', () => {
        const registry: OutputStoreRegistry = {
            stores: [
                { name: 'a', path: '/a' },
                { name: 'b', path: '/b' },
                { name: 'c', path: '/c' },
            ],
        };
        const result = toonSerialize('store-registry', registry);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Header format with tab-separated count: key[count\t]{fields}:
            expect(result.value).toMatch(/stores\[3\t\]\{name\tpath\}:/);
        }
    });
});
