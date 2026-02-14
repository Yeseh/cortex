import { describe, expect, it } from 'bun:test';

import { parseMemory, serializeMemory } from './memories.ts';

describe('memory file parsing', () => {
    it('should parse frontmatter with required fields and optional expiry', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal, onboarding]',
            'source: user',
            'expires_at: 2024-02-01T00:00:00.000Z',
            '---',
            'Remember the onboarding checklist.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.createdAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
            expect(result.value.metadata.updatedAt.toISOString()).toBe('2024-01-02T00:00:00.000Z');
            expect(result.value.metadata.expiresAt?.toISOString()).toBe('2024-02-01T00:00:00.000Z');
            expect(result.value.metadata.tags).toEqual([
                'personal', 'onboarding',
            ]);
            expect(result.value.metadata.source).toBe('user');
            expect(result.value.content).toBe('Remember the onboarding checklist.');
        }
    });

    it('should require all mandatory frontmatter fields', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal]',
            '---',
            'Missing the source field.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('MISSING_FIELD');
            expect(result.error.field).toBe('source');
        }
    });

    it('should fail when frontmatter closing marker is missing', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal]',
            'source: user',
            'This line should be treated as content.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('MISSING_FRONTMATTER');
        }
    });

    it('should reject files without starting frontmatter', () => {
        const raw = [
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal]',
            'source: user',
            '---',
            'Missing opening marker.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('MISSING_FRONTMATTER');
        }
    });

    it('should reject invalid timestamp formats', () => {
        const raw = [
            '---',
            'created_at: not-a-date',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal]',
            'source: user',
            '---',
            'Invalid timestamp format.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_TIMESTAMP');
            expect(result.error.field).toBe('created_at');
        }
    });

    it('should parse tags in list style', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags:',
            '- product',
            '- research',
            'source: user',
            '---',
            'Tags list style.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.tags).toEqual([
                'product', 'research',
            ]);
            expect(result.value.content).toBe('Tags list style.');
        }
    });

    it('should allow empty inline tags list', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: []',
            'source: user',
            '---',
            'No tags inline.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.tags).toEqual([]);
            expect(result.value.content).toBe('No tags inline.');
        }
    });

    it('should allow empty tags list in list style', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags:',
            'source: user',
            '---',
            'No tags in list style.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.tags).toEqual([]);
            expect(result.value.content).toBe('No tags in list style.');
        }
    });

    it('should reject empty source values', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal]',
            'source:    ',
            '---',
            'Missing source.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_SOURCE');
            expect(result.error.field).toBe('source');
        }
    });

    it('should reject duplicate frontmatter keys', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal]',
            'source: user',
            'source: duplicate',
            '---',
            'Duplicate keys.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_FRONTMATTER');
        }
    });

    it('should reject invalid frontmatter entries', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal]',
            'source: user',
            'broken entry',
            '---',
            'Invalid frontmatter line.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_FRONTMATTER');
        }
    });

    it('should normalize trailing commas in inline tags', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal,  ]',
            'source: user',
            '---',
            'Trailing commas are normalized by yaml parser.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.tags).toEqual(['personal']);
        }
    });

    it('should reject empty tags in list style', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags:',
            '- ',
            'source: user',
            '---',
            'Invalid tag entry.',
        ].join('\n');

        const result = parseMemory(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_TAGS');
        }
    });
});

describe('memory file serialization', () => {
    it('should serialize and re-parse consistently', () => {
        const memory = {
            metadata: {
                createdAt: new Date('2024-03-01T08:30:00.000Z'),
                updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                tags: [
                    'alpha', 'beta',
                ],
                source: 'system',
                expiresAt: new Date('2024-04-01T00:00:00.000Z'),
                citations: [],
            },
            content: 'Memory payload with multiple lines.\nSecond line.',
        };

        const serialized = serializeMemory(memory);
        expect(serialized.ok()).toBe(true);
        if (!serialized.ok()) {
            return;
        }

        const reparsed = parseMemory(serialized.value);
        expect(reparsed.ok()).toBe(true);
        if (reparsed.ok()) {
            expect(reparsed.value.metadata.createdAt.toISOString()).toBe(
                '2024-03-01T08:30:00.000Z',
            );
            expect(reparsed.value.metadata.updatedAt.toISOString()).toBe(
                '2024-03-02T10:15:00.000Z',
            );
            expect(reparsed.value.metadata.expiresAt?.toISOString()).toBe(
                '2024-04-01T00:00:00.000Z',
            );
            expect(reparsed.value.metadata.tags).toEqual([
                'alpha', 'beta',
            ]);
            expect(reparsed.value.metadata.source).toBe('system');
            expect(reparsed.value.content).toBe(
                'Memory payload with multiple lines.\nSecond line.',
            );
        }
    });

    it('should round-trip empty content', () => {
        const memory = {
            metadata: {
                createdAt: new Date('2024-03-01T08:30:00.000Z'),
                updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                tags: ['alpha'],
                source: 'system',
                citations: [],
            },
            content: '',
        };

        const serialized = serializeMemory(memory);
        expect(serialized.ok()).toBe(true);
        if (!serialized.ok()) {
            return;
        }

        const reparsed = parseMemory(serialized.value);
        expect(reparsed.ok()).toBe(true);
        if (reparsed.ok()) {
            expect(reparsed.value.content).toBe('');
        }
    });

    it('should round-trip content that starts with a newline', () => {
        const memory = {
            metadata: {
                createdAt: new Date('2024-03-01T08:30:00.000Z'),
                updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                tags: ['alpha'],
                source: 'system',
                citations: [],
            },
            content: '\nLeading newline content.',
        };

        const serialized = serializeMemory(memory);
        expect(serialized.ok()).toBe(true);
        if (!serialized.ok()) {
            return;
        }

        const reparsed = parseMemory(serialized.value);
        expect(reparsed.ok()).toBe(true);
        if (reparsed.ok()) {
            expect(reparsed.value.content).toBe('Leading newline content.');
        }
    });

    it('should reject invalid timestamps during serialization', () => {
        const memory = {
            metadata: {
                createdAt: new Date('invalid'),
                updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                tags: ['alpha'],
                source: 'system',
                citations: [],
            },
            content: 'Serialized memory.',
        };

        const result = serializeMemory(memory);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_TIMESTAMP');
            expect(result.error.field).toBe('created_at');
        }
    });

    it('should reject non-array tags during serialization', () => {
        const memory = {
            metadata: {
                createdAt: new Date('2024-03-01T08:30:00.000Z'),
                updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                tags: 'alpha',
                source: 'system',
                citations: [],
            },
            content: 'Serialized memory.',
        };

        const result = serializeMemory(
            memory as unknown as Parameters<typeof serializeMemory>[0],
        );

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_TAGS');
            expect(result.error.field).toBe('tags');
        }
    });

    it('should reject non-string tags during serialization', () => {
        const memory = {
            metadata: {
                createdAt: new Date('2024-03-01T08:30:00.000Z'),
                updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                tags: [
                    'alpha', 42,
                ],
                source: 'system',
                citations: [],
            },
            content: 'Serialized memory.',
        };

        const result = serializeMemory(
            memory as unknown as Parameters<typeof serializeMemory>[0],
        );

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_TAGS');
            expect(result.error.field).toBe('tags');
        }
    });

    it('should reject empty source during serialization', () => {
        const memory = {
            metadata: {
                createdAt: new Date('2024-03-01T08:30:00.000Z'),
                updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                tags: ['alpha'],
                source: ' ',
                citations: [],
            },
            content: 'Serialized memory.',
        };

        const result = serializeMemory(memory);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_SOURCE');
            expect(result.error.field).toBe('source');
        }
    });
});

describe('memory citations', () => {
    it('should parse frontmatter with citations', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [architecture]',
            'source: user',
            'citations:',
            '  - src/types.ts:17',
            '  - https://docs.example.com',
            '---',
            'Memory with citations.',
        ].join('\n');

        const result = parseMemory(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.citations).toEqual([
                'src/types.ts:17',
                'https://docs.example.com',
            ]);
        }
    });

    it('should default citations to empty array when not present', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: [personal]',
            'source: user',
            '---',
            'Memory without citations field.',
        ].join('\n');

        const result = parseMemory(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.metadata.citations).toEqual([]);
        }
    });

    it('should round-trip memory with citations', () => {
        const memory = {
            metadata: {
                createdAt: new Date('2024-01-01T00:00:00.000Z'),
                updatedAt: new Date('2024-01-02T00:00:00.000Z'),
                tags: ['test'],
                source: 'user',
                citations: [
                    'src/file.ts:10', 'https://example.com',
                ],
            },
            content: 'Test content.',
        };

        const serialized = serializeMemory(memory);
        expect(serialized.ok()).toBe(true);
        if (!serialized.ok()) {
            return;
        }

        const reparsed = parseMemory(serialized.value);
        expect(reparsed.ok()).toBe(true);
        if (reparsed.ok()) {
            expect(reparsed.value.metadata.citations).toEqual([
                'src/file.ts:10',
                'https://example.com',
            ]);
        }
    });

    it('should omit citations key from frontmatter when array is empty', () => {
        const memory = {
            metadata: {
                createdAt: new Date('2024-01-01T00:00:00.000Z'),
                updatedAt: new Date('2024-01-02T00:00:00.000Z'),
                tags: ['test'],
                source: 'user',
                citations: [],
            },
            content: 'Test content.',
        };

        const result = serializeMemory(memory);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).not.toContain('citations:');
        }
    });

    it('should reject empty citation strings', () => {
        const raw = [
            '---',
            'created_at: 2024-01-01T00:00:00.000Z',
            'updated_at: 2024-01-02T00:00:00.000Z',
            'tags: []',
            'source: user',
            'citations:',
            '  - ""',
            '---',
            'Invalid citation.',
        ].join('\n');

        const result = parseMemory(raw);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_CITATIONS');
        }
    });
});

