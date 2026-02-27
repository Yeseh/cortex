import { describe, expect, it } from 'bun:test';

import {
    flattenCategoryPaths,
    getDefaultSettings,
    isConfigDefined,
    parseConfig,
} from './config/config.ts';

describe('ConfigSettings', () => {
    it('should provide default values', () => {
        const defaults = getDefaultSettings();
        expect(defaults.outputFormat).toBe('yaml');
        expect(defaults.defaultStore).toBe('global');
    });
});

describe('parseConfig', () => {
    it('should parse config with settings and stores sections', () => {
        const raw = `
settings:
  outputFormat: json
stores:
  global:
    kind: filesystem
    properties:
      path: /home/user/.config/cortex/memory
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings?.outputFormat).toBe('json');
            expect(result.value.stores.global?.properties.path).toBe(
                '/home/user/.config/cortex/memory'
            );
        }
    });

    it('should use defaults when settings are omitted', () => {
        const raw = `
stores:
  global:
    kind: filesystem
    properties:
      path: /data/default
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            // settings is optional, defaults applied at runtime
            expect(result.value.stores.global?.properties.path).toBe('/data/default');
        }
    });

    it('should parse empty config', () => {
        const result = parseConfig('');
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores).toBeDefined();
        }
    });

    it('should reject invalid outputFormat', () => {
        const raw = `
settings:
  outputFormat: invalid
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
        }
    });

    it('should require store path property', () => {
        const raw = `
stores:
  invalid:
    kind: filesystem
    properties: {}
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
            expect(result.error.store).toBe('invalid');
        }
    });

    it('should parse store with description', () => {
        const raw = `
stores:
  global:
    kind: filesystem
    description: The default memory store
    properties:
      path: /data/default
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.global?.description).toBe('The default memory store');
        }
    });
});

describe('parseConfig category hierarchy', () => {
    it('should parse store with explicit categoryMode', () => {
        const raw = `
stores:
  global:
    kind: filesystem
    categoryMode: strict
    properties:
      path: /data/default
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.global?.categoryMode).toBe('strict');
        }
    });

    it('should parse store without categoryMode (key omitted)', () => {
        const raw = `
stores:
  global:
    kind: filesystem
    properties:
      path: /data/default
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.global?.categoryMode).toBeUndefined();
        }
    });

    it('should reject invalid categoryMode value', () => {
        const raw = `
stores:
  global:
    kind: filesystem
    categoryMode: invalid
    properties:
      path: /data/default
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
        }
    });

    it('should parse store with nested category hierarchy', () => {
        const raw = `
stores:
  global:
    kind: filesystem
    properties:
      path: /data/default
    categories:
      standards:
        description: Coding standards
        subcategories:
          architecture:
            description: Architecture decisions
          testing:
            description: Testing guidelines
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            const categories = result.value.stores.global?.categories;
            expect(categories).toBeDefined();
            expect(categories?.standards?.description).toBe('Coding standards');
            expect(categories?.standards?.subcategories?.architecture?.description).toBe(
                'Architecture decisions'
            );
            expect(categories?.standards?.subcategories?.testing?.description).toBe(
                'Testing guidelines'
            );
        }
    });

    it('should parse category without description', () => {
        const raw = `
stores:
  global:
    kind: filesystem
    properties:
      path: /data/default
    categories:
      todos: {}
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.global?.categories?.todos).toEqual({});
        }
    });

    it('should parse deeply nested categories', () => {
        const raw = `
stores:
  global:
    kind: filesystem
    properties:
      path: /data/default
    categories:
      level1:
        subcategories:
          level2:
            subcategories:
              level3:
                description: Third level
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            const level3 =
                result.value.stores.global?.categories?.level1?.subcategories?.level2
                    ?.subcategories?.level3;
            expect(level3?.description).toBe('Third level');
        }
    });

    it('should reject category description exceeding 500 characters', () => {
        const longDescription = 'x'.repeat(501);
        const raw = `
stores:
  global:
    kind: filesystem
    properties:
      path: /data/default
    categories:
      test:
        description: "${longDescription}"
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.message).toContain('exceeds 500 characters');
        }
    });
});

describe('flattenCategoryPaths', () => {
    it('should return empty array for undefined', () => {
        expect(flattenCategoryPaths(undefined)).toEqual([]);
    });

    it('should return empty array for empty object', () => {
        expect(flattenCategoryPaths({})).toEqual([]);
    });

    it('should flatten single level categories', () => {
        const cats = { alpha: {}, beta: {} };
        expect(flattenCategoryPaths(cats)).toEqual(['alpha', 'beta']);
    });

    it('should flatten nested categories', () => {
        const cats = {
            standards: {
                subcategories: {
                    architecture: {},
                    testing: {},
                },
            },
        };
        const result = flattenCategoryPaths(cats);
        expect(result).toContain('standards');
        expect(result).toContain('standards/architecture');
        expect(result).toContain('standards/testing');
    });

    it('should flatten deeply nested categories', () => {
        const cats = {
            a: {
                subcategories: {
                    b: {
                        subcategories: {
                            c: {},
                        },
                    },
                },
            },
        };
        expect(flattenCategoryPaths(cats)).toEqual(['a', 'a/b', 'a/b/c']);
    });
});

describe('isConfigDefined', () => {
    const cats = {
        standards: {
            subcategories: {
                architecture: {},
            },
        },
        todos: {},
    };

    it('should return false for undefined categories', () => {
        expect(isConfigDefined('anything', undefined)).toBe(false);
    });

    it('should return false for empty path', () => {
        expect(isConfigDefined('', cats)).toBe(false);
    });

    it('should return true for explicitly defined root category', () => {
        expect(isConfigDefined('standards', cats)).toBe(true);
        expect(isConfigDefined('todos', cats)).toBe(true);
    });

    it('should return true for explicitly defined nested category', () => {
        expect(isConfigDefined('standards/architecture', cats)).toBe(true);
    });

    it('should return false for non-defined category', () => {
        expect(isConfigDefined('legacy', cats)).toBe(false);
        expect(isConfigDefined('standards/testing', cats)).toBe(false);
    });

    it('should return false for partial path to non-existent category', () => {
        expect(isConfigDefined('standards/architecture/deep', cats)).toBe(false);
    });
});
