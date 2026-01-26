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
        tags: [
            'test', 
            'example',
        ],
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
            // Should contain all metadata fields with key folding (dotted notation)
            expect(result.value).toContain('path:global/persona/test-memory');
            // Timestamps are quoted because they contain colons
            expect(result.value).toContain('metadata.created_at:"2024-01-15T10:00:00.000Z"');
            expect(result.value).toContain('metadata.updated_at:"2024-01-16T14:30:00.000Z"');
            expect(result.value).toContain('metadata.tags:');
            expect(result.value).toContain('metadata.source:unit-test');
            expect(result.value).toContain('metadata.token_estimate:42');
            expect(result.value).toContain('content:This is test content.');
        }
    });

    test('uses key folding for metadata paths (e.g., metadata.created_at)', () => {
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
            // Key folding should produce dotted notation
            expect(result.value).toContain('metadata.created_at:');
            expect(result.value).toContain('metadata.tags:');
            // Should NOT have nested object syntax like metadata:{created_at:...}
            expect(result.value).not.toMatch(/metadata:\{/);
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
            expect(result.value).toContain('path:test/minimal');
            expect(result.value).toContain('metadata.created_at:');
            expect(result.value).toContain('content:Minimal content');
            // Should NOT contain optional fields that weren't set
            expect(result.value).not.toContain('updated_at');
            expect(result.value).not.toContain('source');
            expect(result.value).not.toContain('token_estimate');
            expect(result.value).not.toContain('expires_at');
        }
    });

    test('returns error for invalid path', () => {
        const memory: OutputMemory = {
            path: '   ', // Invalid: empty/whitespace
            metadata: {
                createdAt: new Date('2024-01-15T10:00:00Z'),
                tags: [],
            },
            content: 'Content',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('path');
        }
    });

    test('returns error for invalid createdAt', () => {
        const memory: OutputMemory = {
            path: 'test/path',
            metadata: {
                createdAt: new Date('invalid date'),
                tags: [],
            },
            content: 'Content',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('created_at');
        }
    });
});

describe('serializeCategoryToon', () => {
    test('encodes category with memories and subcategories', () => {
        const result = toonSerialize('category', sampleCategory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('path:global/persona');
            // Memories array is non-uniform (some have summary, some don't) so uses JSON-like serialization
            expect(result.value).toContain('memories:');
            // Subcategories are uniform so uses tabular format
            expect(result.value).toContain('subcategories[1]');
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
            // Tabular format: header with field names, then rows
            expect(result.value).toMatch(/memories\[2\]\{[^}]+\}:/);
            // Should contain memory paths in the rows
            expect(result.value).toContain('test/mem1');
            expect(result.value).toContain('test/mem2');
        }
    });

    test('uses tabular format for subcategories array', () => {
        const result = toonSerialize('category', sampleCategory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Tabular format for subcategories
            expect(result.value).toMatch(/subcategories\[1\]\{[^}]+\}:/);
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
            // Empty arrays are serialized as empty string in TOON
            expect(result.value).toContain('memories:');
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
            // Empty arrays are serialized as empty string in TOON
            expect(result.value).toContain('subcategories:');
        }
    });

    test('returns error for invalid path', () => {
        const category: OutputCategory = {
            path: '', // Invalid: empty
            memories: [],
            subcategories: [],
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('path');
        }
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
            expect(result.value).toContain('store.name:my-store');
            expect(result.value).toContain('store.path:/data/my-store');
        }
    });

    test('returns error for invalid store name', () => {
        const store: OutputStore = {
            name: 'Invalid Name!', // Invalid: not lowercase slug
            path: '/data/store',
        };
        const result = toonSerialize('store', store);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('store.name');
            expect(result.error.message).toContain('lowercase slug');
        }
    });

    test('returns error for invalid store path', () => {
        const store: OutputStore = {
            name: 'valid-name',
            path: '   ', // Invalid: empty/whitespace
        };
        const result = toonSerialize('store', store);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('store.path');
        }
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
            expect(result.value).toContain('stores[2]');
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
            // Tabular format: header with count and field names
            expect(result.value).toMatch(/stores\[2\]\{[^}]+\}:/);
        }
    });

    test('handles empty stores array', () => {
        const registry: OutputStoreRegistry = {
            stores: [],
        };
        const result = toonSerialize('store-registry', registry);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Empty arrays are serialized as empty string in TOON
            expect(result.value).toContain('stores:');
        }
    });

    test('returns error for invalid store in array', () => {
        const registry: OutputStoreRegistry = {
            stores: [
                { name: 'valid-store', path: '/valid' },
                { name: 'INVALID STORE', path: '/invalid' }, // Invalid name
            ],
        };
        const result = toonSerialize('store-registry', registry);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('stores.name');
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
            expect(result.value).toContain('path:/initialized/store/path');
        }
    });

    test('returns error for empty path', () => {
        const storeInit: OutputStoreInit = {
            path: '',
        };
        const result = toonSerialize('store-init', storeInit);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('path');
        }
    });
});

describe('serializeInitToon', () => {
    test('encodes init with path and categories', () => {
        const init: OutputInit = {
            path: '/project/root',
            categories: [
                'persona', 
                'project', 
                'domain',
            ],
        };
        const result = toonSerialize('init', init);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('path:/project/root');
            expect(result.value).toContain('categories:');
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
            expect(result.value).toContain('path:/project/empty');
            // Empty arrays are serialized as empty string in TOON
            expect(result.value).toContain('categories:');
        }
    });

    test('returns error for empty path', () => {
        const init: OutputInit = {
            path: '   ',
            categories: ['test'],
        };
        const result = toonSerialize('init', init);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('path');
        }
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
                tags: [
                    'emoji', 
                    'unicode',
                ],
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
            // Timestamps are quoted because they contain colons
            expect(result.value).toContain('metadata.expires_at:"2025-01-15T10:00:00.000Z"');
        }
    });

    test('handles category memory with summary containing special characters', () => {
        const category: OutputCategory = {
            path: 'test/special-summary',
            memories: [{
                path: 'test/mem1',
                tokenEstimate: 10,
                summary: 'Summary with "quotes" and: colons',
            }],
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
                tags: [
                    'tag1', 
                    'tag-two', 
                    'tag_three',
                ],
            },
            content: 'Tagged content',
        };
        const result = toonSerialize('memory', memory);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toContain('metadata.tags:');
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
            // Empty tags array is serialized as empty string in TOON
            expect(result.value).toContain('metadata.tags:');
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
            expect(result.value).toContain('metadata.token_estimate:999999');
        }
    });

    test('returns error for negative token estimate', () => {
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

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('token_estimate');
        }
    });

    test('returns error for non-finite token estimate', () => {
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

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('token_estimate');
        }
    });

    test('returns error for invalid updatedAt date', () => {
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

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('updated_at');
        }
    });

    test('returns error for invalid expiresAt date', () => {
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

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('expires_at');
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

    test('returns error for negative memory count in subcategory', () => {
        const category: OutputCategory = {
            path: 'test/negative-count',
            memories: [],
            subcategories: [{ path: 'test/invalid-sub', memoryCount: -1 }],
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('subcategories.memory_count');
        }
    });

    test('returns error for invalid memory path in category', () => {
        const category: OutputCategory = {
            path: 'test/valid-path',
            memories: [{ path: '   ', tokenEstimate: 10 }], // Invalid empty path
            subcategories: [],
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('memories.path');
        }
    });

    test('returns error for invalid subcategory path', () => {
        const category: OutputCategory = {
            path: 'test/valid-path',
            memories: [],
            subcategories: [{ path: '', memoryCount: 5 }], // Invalid empty path
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('subcategories.path');
        }
    });

    test('returns error for negative token estimate in category memory', () => {
        const category: OutputCategory = {
            path: 'test/valid-path',
            memories: [{ path: 'test/mem', tokenEstimate: -10 }],
            subcategories: [],
        };
        const result = toonSerialize('category', category);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_FIELD');
            expect(result.error.field).toBe('memories.token_estimate');
        }
    });
});

describe('TOON format output structure', () => {
    test('uses tab delimiters between key-value pairs', () => {
        const store: OutputStore = {
            name: 'test-store',
            path: '/test/path',
        };
        const result = toonSerialize('store', store);

        expect(result.ok).toBe(true);
        if (result.ok) {
            // Tab delimiter between fields
            expect(result.value).toContain('\t');
        }
    });

    test('output does not contain nested object braces with key folding', () => {
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
            // With safe key folding, metadata should be flattened
            expect(result.value).not.toMatch(/metadata:\{/);
        }
    });

    test('tabular format uses correct header syntax', () => {
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
            // Header format: key[count]{fields}:
            expect(result.value).toMatch(/stores\[3\]\{name\tpath\}:/);
        }
    });
});
