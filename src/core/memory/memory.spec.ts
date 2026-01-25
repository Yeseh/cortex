import { describe, expect, it } from 'bun:test';

import { normalizeSlugSegments } from '../slug.ts';
import { parseMemoryFile, serializeMemoryFile } from './file.ts';
import { validateCategoryPath, validateMemorySlugPath } from './validation.ts';

describe(
    'memory slug validation', () => {
        it(
            'should accept category/memory slug paths', () => {
                const result = validateMemorySlugPath('working/preferences');

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.slugPath).toBe('working/preferences');
                    expect(result.value.categories).toEqual(['working']);
                    expect(result.value.slug).toBe('preferences');
                }
            },
        );

        it(
            'should accept category/subcategory/memory slug paths', () => {
                const result = validateMemorySlugPath('semantic/concepts/priority-cues');

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.slugPath).toBe('semantic/concepts/priority-cues');
                    expect(result.value.categories).toEqual([ 'semantic',
                        'concepts' ]);
                    expect(result.value.slug).toBe('priority-cues');
                }
            },
        );

        it(
            'should reject slug paths with invalid depth', () => {
                const tooShallow = validateMemorySlugPath('working');

                expect(tooShallow.ok).toBe(false);
                if (!tooShallow.ok) {
                    expect(tooShallow.error.code).toBe('INVALID_SLUG_PATH'); 
                }
            },
        );

        it(
            'should accept deep slug paths', () => {
                const result = validateMemorySlugPath('a/b/c/d');

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.slugPath).toBe('a/b/c/d');
                    expect(result.value.categories).toEqual([
                        'a',
                        'b',
                        'c',
                    ]);
                    expect(result.value.slug).toBe('d');
                }
            },
        );

        it(
            'should normalize whitespace and empty segments', () => {
                const normalized = normalizeSlugSegments([
                    '  working ',
                    ' ',
                    'memory  ',
                ]);
                expect(normalized).toEqual([ 'working',
                    'memory' ]);

                const result = validateMemorySlugPath('working/ /memory');
                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.slugPath).toBe('working/memory');
                    expect(result.value.categories).toEqual(['working']);
                    expect(result.value.slug).toBe('memory');
                }
            },
        );
    },
);

describe(
    'memory category validation', () => {
        it(
            'should accept one or two category segments', () => {
                const oneLevel = validateCategoryPath(['working']);
                expect(oneLevel.ok).toBe(true);
                if (oneLevel.ok) {
                    expect(oneLevel.value).toEqual(['working']); 
                }

                const twoLevel = validateCategoryPath([ 'semantic',
                    'concepts' ]);
                expect(twoLevel.ok).toBe(true);
                if (twoLevel.ok) {
                    expect(twoLevel.value).toEqual([ 'semantic',
                        'concepts' ]); 
                }
            },
        );

        it(
            'should reject categories outside the allowed depth', () => {
                const empty = validateCategoryPath([]);

                expect(empty.ok).toBe(false);
                if (!empty.ok) {
                    expect(empty.error.code).toBe('INVALID_CATEGORY_DEPTH'); 
                }
            },
        );

        it(
            'should accept deep category paths', () => {
                const deep = validateCategoryPath([
                    'one',
                    'two',
                    'three',
                ]);

                expect(deep.ok).toBe(true);
                if (deep.ok) {
                    expect(deep.value).toEqual([
                        'one',
                        'two',
                        'three',
                    ]); 
                }
            },
        );

        it(
            'should reject non-slug segments', () => {
                const result = validateCategoryPath([ 'Working',
                    'notes' ]);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_SLUG');
                    expect(result.error.segment).toBe('Working');
                }
            },
        );
    },
);

describe(
    'memory file parsing', () => {
        it(
            'should parse frontmatter with required fields and optional expiry', () => {
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

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.frontmatter.createdAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');
                    expect(result.value.frontmatter.updatedAt.toISOString()).toBe('2024-01-02T00:00:00.000Z');
                    expect(result.value.frontmatter.expiresAt?.toISOString()).toBe('2024-02-01T00:00:00.000Z');
                    expect(result.value.frontmatter.tags).toEqual([ 'personal',
                        'onboarding' ]);
                    expect(result.value.frontmatter.source).toBe('user');
                    expect(result.value.content).toBe('Remember the onboarding checklist.');
                }
            },
        );

        it(
            'should require all mandatory frontmatter fields', () => {
                const raw = [
                    '---',
                    'created_at: 2024-01-01T00:00:00.000Z',
                    'updated_at: 2024-01-02T00:00:00.000Z',
                    'tags: [personal]',
                    '---',
                    'Missing the source field.',
                ].join('\n');

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('MISSING_FIELD');
                    expect(result.error.field).toBe('source');
                }
            },
        );

        it(
            'should fail when frontmatter closing marker is missing', () => {
                const raw = [
                    '---',
                    'created_at: 2024-01-01T00:00:00.000Z',
                    'updated_at: 2024-01-02T00:00:00.000Z',
                    'tags: [personal]',
                    'source: user',
                    'This line should be treated as content.',
                ].join('\n');

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('MISSING_FRONTMATTER'); 
                }
            },
        );

        it(
            'should reject files without starting frontmatter', () => {
                const raw = [
                    'created_at: 2024-01-01T00:00:00.000Z',
                    'updated_at: 2024-01-02T00:00:00.000Z',
                    'tags: [personal]',
                    'source: user',
                    '---',
                    'Missing opening marker.',
                ].join('\n');

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('MISSING_FRONTMATTER'); 
                }
            },
        );

        it(
            'should reject invalid timestamp formats', () => {
                const raw = [
                    '---',
                    'created_at: not-a-date',
                    'updated_at: 2024-01-02T00:00:00.000Z',
                    'tags: [personal]',
                    'source: user',
                    '---',
                    'Invalid timestamp format.',
                ].join('\n');

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_TIMESTAMP');
                    expect(result.error.field).toBe('created_at');
                }
            },
        );

        it(
            'should parse tags in list style', () => {
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

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.frontmatter.tags).toEqual([ 'product',
                        'research' ]);
                    expect(result.value.content).toBe('Tags list style.');
                }
            },
        );

        it(
            'should allow empty inline tags list', () => {
                const raw = [
                    '---',
                    'created_at: 2024-01-01T00:00:00.000Z',
                    'updated_at: 2024-01-02T00:00:00.000Z',
                    'tags: []',
                    'source: user',
                    '---',
                    'No tags inline.',
                ].join('\n');

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.frontmatter.tags).toEqual([]);
                    expect(result.value.content).toBe('No tags inline.');
                }
            },
        );

        it(
            'should allow empty tags list in list style', () => {
                const raw = [
                    '---',
                    'created_at: 2024-01-01T00:00:00.000Z',
                    'updated_at: 2024-01-02T00:00:00.000Z',
                    'tags:',
                    'source: user',
                    '---',
                    'No tags in list style.',
                ].join('\n');

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.frontmatter.tags).toEqual([]);
                    expect(result.value.content).toBe('No tags in list style.');
                }
            },
        );

        it(
            'should reject empty source values', () => {
                const raw = [
                    '---',
                    'created_at: 2024-01-01T00:00:00.000Z',
                    'updated_at: 2024-01-02T00:00:00.000Z',
                    'tags: [personal]',
                    'source:    ',
                    '---',
                    'Missing source.',
                ].join('\n');

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_SOURCE');
                    expect(result.error.field).toBe('source');
                }
            },
        );

        it(
            'should reject duplicate frontmatter keys', () => {
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

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_FRONTMATTER'); 
                }
            },
        );

        it(
            'should reject invalid frontmatter entries', () => {
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

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_FRONTMATTER'); 
                }
            },
        );

        it(
            'should reject empty tags in inline lists', () => {
                const raw = [
                    '---',
                    'created_at: 2024-01-01T00:00:00.000Z',
                    'updated_at: 2024-01-02T00:00:00.000Z',
                    'tags: [personal,  ]',
                    'source: user',
                    '---',
                    'Invalid tag entry.',
                ].join('\n');

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_TAGS'); 
                }
            },
        );

        it(
            'should reject empty tags in list style', () => {
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

                const result = parseMemoryFile(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_TAGS'); 
                }
            },
        );
    },
);

describe(
    'memory file serialization', () => {
        it(
            'should serialize and re-parse consistently', () => {
                const memory = {
                    frontmatter: {
                        createdAt: new Date('2024-03-01T08:30:00.000Z'),
                        updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                        tags: [ 'alpha',
                            'beta' ],
                        source: 'system',
                        expiresAt: new Date('2024-04-01T00:00:00.000Z'),
                    },
                    content: 'Memory payload with multiple lines.\nSecond line.',
                };

                const serialized = serializeMemoryFile(memory);
                expect(serialized.ok).toBe(true);
                if (!serialized.ok) {
                    return; 
                }

                const reparsed = parseMemoryFile(serialized.value);
                expect(reparsed.ok).toBe(true);
                if (reparsed.ok) {
                    expect(reparsed.value.frontmatter.createdAt.toISOString()).toBe('2024-03-01T08:30:00.000Z');
                    expect(reparsed.value.frontmatter.updatedAt.toISOString()).toBe('2024-03-02T10:15:00.000Z');
                    expect(reparsed.value.frontmatter.expiresAt?.toISOString()).toBe('2024-04-01T00:00:00.000Z');
                    expect(reparsed.value.frontmatter.tags).toEqual([ 'alpha',
                        'beta' ]);
                    expect(reparsed.value.frontmatter.source).toBe('system');
                    expect(reparsed.value.content).toBe('Memory payload with multiple lines.\nSecond line.');
                }
            },
        );

        it(
            'should round-trip empty content', () => {
                const memory = {
                    frontmatter: {
                        createdAt: new Date('2024-03-01T08:30:00.000Z'),
                        updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                        tags: ['alpha'],
                        source: 'system',
                    },
                    content: '',
                };

                const serialized = serializeMemoryFile(memory);
                expect(serialized.ok).toBe(true);
                if (!serialized.ok) {
                    return; 
                }

                const reparsed = parseMemoryFile(serialized.value);
                expect(reparsed.ok).toBe(true);
                if (reparsed.ok) {
                    expect(reparsed.value.content).toBe(''); 
                }
            },
        );

        it(
            'should round-trip content that starts with a newline', () => {
                const memory = {
                    frontmatter: {
                        createdAt: new Date('2024-03-01T08:30:00.000Z'),
                        updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                        tags: ['alpha'],
                        source: 'system',
                    },
                    content: '\nLeading newline content.',
                };

                const serialized = serializeMemoryFile(memory);
                expect(serialized.ok).toBe(true);
                if (!serialized.ok) {
                    return; 
                }

                const reparsed = parseMemoryFile(serialized.value);
                expect(reparsed.ok).toBe(true);
                if (reparsed.ok) {
                    expect(reparsed.value.content).toBe('Leading newline content.'); 
                }
            },
        );

        it(
            'should reject invalid timestamps during serialization', () => {
                const memory = {
                    frontmatter: {
                        createdAt: new Date('invalid'),
                        updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                        tags: ['alpha'],
                        source: 'system',
                    },
                    content: 'Serialized memory.',
                };

                const result = serializeMemoryFile(memory);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_TIMESTAMP');
                    expect(result.error.field).toBe('created_at');
                }
            },
        );

        it(
            'should reject non-array tags during serialization', () => {
                const memory = {
                    frontmatter: {
                        createdAt: new Date('2024-03-01T08:30:00.000Z'),
                        updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                        tags: 'alpha',
                        source: 'system',
                    },
                    content: 'Serialized memory.',
                };

                const result = serializeMemoryFile(memory as unknown as Parameters<typeof serializeMemoryFile>[ 0 ]);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_TAGS');
                    expect(result.error.field).toBe('tags');
                }
            },
        );

        it(
            'should reject non-string tags during serialization', () => {
                const memory = {
                    frontmatter: {
                        createdAt: new Date('2024-03-01T08:30:00.000Z'),
                        updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                        tags: [ 'alpha',
                            42 ],
                        source: 'system',
                    },
                    content: 'Serialized memory.',
                };

                const result = serializeMemoryFile(memory as unknown as Parameters<typeof serializeMemoryFile>[ 0 ]);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_TAGS');
                    expect(result.error.field).toBe('tags');
                }
            },
        );

        it(
            'should reject empty source during serialization', () => {
                const memory = {
                    frontmatter: {
                        createdAt: new Date('2024-03-01T08:30:00.000Z'),
                        updatedAt: new Date('2024-03-02T10:15:00.000Z'),
                        tags: ['alpha'],
                        source: ' ',
                    },
                    content: 'Serialized memory.',
                };

                const result = serializeMemoryFile(memory);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_SOURCE');
                    expect(result.error.field).toBe('source');
                }
            },
        );
    },
);
