import { describe, expect, it } from 'bun:test';

import { parseStoreRegistry, serializeStoreRegistry } from './registry.ts';

describe(
    'store registry parsing', () => {
        it(
            'should parse top-level store entries', () => {
                const raw = [
                    'primary:',
                    '  path: /var/lib/cortex',
                    'secondary:',
                    '  path: /var/lib/cortex-secondary',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toEqual({
                        primary: { path: '/var/lib/cortex' },
                        secondary: { path: '/var/lib/cortex-secondary' },
                    }); 
                }
            },
        );

        it(
            'should parse stores section entries', () => {
                const raw = [
                    'stores:',
                    '  local:',
                    '    path: ./data/.cortex # comment',
                    '  global:',
                    "    path: 'C:/Cortex Global'",
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toEqual({
                        local: { path: './data/.cortex' },
                        global: { path: 'C:/Cortex Global' },
                    }); 
                }
            },
        );

        it(
            'should reject stores section not at top level', () => {
                const raw = [
                    '  stores:',
                    '    local:',
                    '      path: ./data',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_STORES_SECTION');
                    expect(result.error.line).toBe(1);
                }
            },
        );

        it(
            'should reject store names with invalid characters', () => {
                const raw = [
                    'stores:',
                    '  bad_name:',
                    '    path: /var/lib/cortex',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('UNEXPECTED_ENTRY');
                    expect(result.error.line).toBe(2);
                }
            },
        );

        it(
            'should reject duplicate store names', () => {
                const raw = [
                    'primary:',
                    '  path: /var/lib/cortex',
                    'primary:',
                    '  path: /var/lib/duplicate',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('DUPLICATE_STORE_NAME');
                    expect(result.error.store).toBe('primary');
                }
            },
        );

        it(
            'should reject missing store paths', () => {
                const raw = [
                    'primary:',
                    'secondary:',
                    '  path: /var/lib/cortex',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('MISSING_STORE_PATH');
                    expect(result.error.store).toBe('primary');
                }
            },
        );

        it(
            'should reject empty or comment-only path values', () => {
                const raw = [
                    'primary:',
                    '  path: # empty', 
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_STORE_PATH');
                    expect(result.error.store).toBe('primary');
                }
            },
        );

        it(
            'should reject unexpected entries', () => {
                const raw = [
                    'stores:',
                    '  primary:',
                    '    path: /var/lib',
                    '  extra: true',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('UNEXPECTED_ENTRY');
                    expect(result.error.line).toBe(4);
                }
            },
        );

        it(
            'should reject paths that are not indented under the store', () => {
                const raw = [
                    'primary:',
                    'path: /var/lib', 
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('INVALID_STORE_PATH');
                    expect(result.error.store).toBe('primary');
                }
            },
        );
    },
);

describe(
    'description field parsing', () => {
        it(
            'should parse description after path', () => {
                const raw = [
                    'stores:',
                    '  default:',
                    '    path: "/data/default"',
                    '    description: "Default store for general memories"',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.default?.description).toBe('Default store for general memories');
                }
            },
        );

        it(
            'should parse description before path', () => {
                const raw = [
                    'stores:',
                    '  default:',
                    '    description: "Default store for general memories"',
                    '    path: "/data/default"',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.default?.description).toBe('Default store for general memories');
                    expect(result.value.default?.path).toBe('/data/default');
                }
            },
        );

        it(
            'should parse registry without description (backward compatibility)', () => {
                const raw = [
                    'stores:',
                    '  default:',
                    '    path: "/data/default"',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.default?.path).toBe('/data/default');
                    expect(result.value.default?.description).toBeUndefined();
                }
            },
        );

        it(
            'should parse registry with empty description', () => {
                const raw = [
                    'stores:',
                    '  default:',
                    '    path: "/data/default"',
                    '    description: ""',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.default?.description).toBe('');
                }
            },
        );

        it(
            'should parse registry with quoted description containing special chars', () => {
                const raw = [
                    'stores:',
                    '  default:',
                    '    path: "/data/default"',
                    '    description: "A store with \\"special\\" chars"',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.default?.description).toBe('A store with "special" chars');
                }
            },
        );

        it(
            'should parse multiple stores with mixed descriptions', () => {
                const raw = [
                    'stores:',
                    '  default:',
                    '    path: "/data/default"',
                    '    description: "The default store"',
                    '  project:',
                    '    path: "/data/project"',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value.default?.description).toBe('The default store');
                    expect(result.value.project?.path).toBe('/data/project');
                    expect(result.value.project?.description).toBeUndefined();
                }
            },
        );

        it(
            'should reject duplicate description entries', () => {
                const raw = [
                    'stores:',
                    '  default:',
                    '    path: "/data/default"',
                    '    description: "First description"',
                    '    description: "Second description"',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('UNEXPECTED_ENTRY');
                    expect(result.error.store).toBe('default');
                }
            },
        );

        it(
            'should reject description without store context', () => {
                const raw = [
                    'description: "Orphan description"',
                    'stores:',
                    '  default:',
                    '    path: "/data/default"',
                ].join('\n');

                const result = parseStoreRegistry(raw);

                expect(result.ok).toBe(false);
                if (!result.ok) {
                    expect(result.error.code).toBe('UNEXPECTED_ENTRY');
                }
            },
        );
    },
);

describe(
    'description field serialization', () => {
        it(
            'should serialize registry with description', () => {
                const registry = {
                    default: { path: '/data/default', description: 'A test store' },
                };

                const result = serializeStoreRegistry(registry);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toContain('description: "A test store"');
                }
            },
        );

        it(
            'should serialize registry without description', () => {
                const registry = {
                    default: { path: '/data/default' },
                };

                const result = serializeStoreRegistry(registry);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).not.toContain('description');
                }
            },
        );

        it(
            'should serialize empty description', () => {
                const registry = {
                    default: { path: '/data/default', description: '' },
                };

                const result = serializeStoreRegistry(registry);

                expect(result.ok).toBe(true);
                if (result.ok) {
                    expect(result.value).toContain('description: ""');
                }
            },
        );

        it(
            'should round-trip registry with descriptions', () => {
                const original = {
                    alpha: { path: '/data/alpha', description: 'Alpha store' },
                    beta: { path: '/data/beta' },
                };

                const serialized = serializeStoreRegistry(original);
                expect(serialized.ok).toBe(true);
                if (!serialized.ok) {
                    return;
                }

                const parsed = parseStoreRegistry(serialized.value);
                expect(parsed.ok).toBe(true);
                if (parsed.ok) {
                    expect(parsed.value.alpha?.path).toBe('/data/alpha');
                    expect(parsed.value.alpha?.description).toBe('Alpha store');
                    expect(parsed.value.beta?.path).toBe('/data/beta');
                    expect(parsed.value.beta?.description).toBeUndefined();
                }
            },
        );
    },
);
