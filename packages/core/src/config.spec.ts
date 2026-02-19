import { afterEach, describe, expect, it } from 'bun:test';

import {
    flattenCategoryPaths,
    getConfigDir,
    getConfigPath,
    getDefaultSettings,
    isConfigDefined,
    parseConfig,
    serializeMergedConfig,
    validateStorePath,
    type MergedConfig,
} from './config/config.ts';

describe('ConfigSettings', () => {
    it('should provide default values', () => {
        const defaults = getDefaultSettings();
        expect(defaults.outputFormat).toBe('yaml');
        expect(defaults.autoSummaryThreshold).toBe(0);
        expect(defaults.strictLocal).toBe(false);
    });
});

describe('validateStorePath', () => {
    it('should accept absolute paths', () => {
        const result = validateStorePath('/home/user/.cortex', 'default');
        expect(result.ok()).toBe(true);
    });

    it('should reject relative paths', () => {
        const result = validateStorePath('./relative/path', 'invalid');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
            expect(result.error.store).toBe('invalid');
        }
    });

    it('should reject paths without leading slash', () => {
        const result = validateStorePath('path/without/slash', 'bad');
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
        }
    });
});

describe('parseMergedConfig', () => {
    it('should parse config with settings and stores sections', () => {
        const raw = `
settings:
  outputFormat: json
  autoSummaryThreshold: 10
stores:
  default:
    path: /home/user/.config/cortex/memory
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings.outputFormat).toBe('json');
            expect(result.value.settings.autoSummaryThreshold).toBe(10);
            expect(result.value.settings.strictLocal).toBe(false); // default
            expect(result.value.stores.default?.path).toBe('/home/user/.config/cortex/memory');
        }
    });

    it('should use defaults when settings are omitted', () => {
        const raw = `
stores:
  default:
    path: /data/default
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings.outputFormat).toBe('yaml');
            expect(result.value.settings.autoSummaryThreshold).toBe(0);
            expect(result.value.settings.strictLocal).toBe(false);
        }
    });

    it('should parse empty config', () => {
        const result = parseConfig('');
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings).toEqual(getDefaultSettings());
            expect(Object.keys(result.value.stores)).toHaveLength(0);
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
            expect(result.error.field).toBe('outputFormat');
        }
    });

    it('should reject relative store paths', () => {
        const raw = `
stores:
  invalid:
    path: ./relative/path
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
  default:
    path: /data/default
    description: The default memory store
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.default?.description).toBe('The default memory store');
        }
    });
});

describe('serializeMergedConfig', () => {
    it('should serialize merged config to YAML', () => {
        const config: MergedConfig = {
            settings: { outputFormat: 'json', autoSummaryThreshold: 0, strictLocal: true },
            stores: { default: { path: '/data/default' } },
        };
        const result = serializeMergedConfig(config);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toContain('outputFormat: json');
            expect(result.value).toContain('strictLocal: true');
            expect(result.value).toContain('path: /data/default');
        }
    });

    it('should serialize config without stores', () => {
        const config: MergedConfig = {
            settings: getDefaultSettings(),
            stores: {},
        };
        const result = serializeMergedConfig(config);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toContain('settings:');
            expect(result.value).not.toContain('stores:');
        }
    });

    it('should round-trip config correctly', () => {
        const original: MergedConfig = {
            settings: { outputFormat: 'toon', autoSummaryThreshold: 10, strictLocal: false },
            stores: {
                default: { path: '/home/user/.cortex', description: 'Default store' },
                project: { path: '/project/.cortex' },
            },
        };
        const serialized = serializeMergedConfig(original);
        expect(serialized.ok()).toBe(true);
        if (!serialized.ok()) return;

        const parsed = parseConfig(serialized.value);
        expect(parsed.ok()).toBe(true);
        if (!parsed.ok()) return;

        expect(parsed.value.settings).toEqual(original.settings);
        expect(parsed.value.stores.default?.path).toBe(original.stores.default?.path);
        expect(parsed.value.stores.default?.description).toBe(original.stores.default?.description);
        expect(parsed.value.stores.project?.path).toBe(original.stores.project?.path);
    });
});

describe('getConfigDir', () => {
    const originalEnv = process.env.CORTEX_CONFIG_PATH;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.CORTEX_CONFIG_PATH = originalEnv;
        }
        else {
            delete process.env.CORTEX_CONFIG_PATH;
        }
    });

    it('should use CORTEX_CONFIG_PATH when set', () => {
        process.env.CORTEX_CONFIG_PATH = '/custom/config/path';
        expect(getConfigDir()).toBe('/custom/config/path');
    });

    it('should expand tilde in CORTEX_CONFIG_PATH', () => {
        process.env.CORTEX_CONFIG_PATH = '~/custom-cortex';
        const result = getConfigDir();
        expect(result).not.toContain('~');
        expect(result).toContain('custom-cortex');
    });

    it('should use default when env var not set', () => {
        delete process.env.CORTEX_CONFIG_PATH;
        const result = getConfigDir();
        expect(result).toContain('.config');
        expect(result).toContain('cortex');
    });
});

describe('getConfigPath', () => {
    const originalEnv = process.env.CORTEX_CONFIG_PATH;

    afterEach(() => {
        if (originalEnv !== undefined) {
            process.env.CORTEX_CONFIG_PATH = originalEnv;
        }
        else {
            delete process.env.CORTEX_CONFIG_PATH;
        }
    });

    it('should return config.yaml path with env var', () => {
        process.env.CORTEX_CONFIG_PATH = '/custom/path';
        expect(getConfigPath()).toBe('/custom/path/config.yaml');
    });

    it('should return default config.yaml path', () => {
        delete process.env.CORTEX_CONFIG_PATH;
        const result = getConfigPath();
        expect(result).toContain('config.yaml');
        expect(result).toContain('.config/cortex');
    });
});

describe('parseMergedConfig category hierarchy', () => {
    it('should parse store with explicit categoryMode', () => {
        const raw = `
stores:
  default:
    path: /data/default
    categoryMode: strict
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.default?.categoryMode).toBe('strict');
        }
    });

    it('should parse store without categoryMode (key omitted)', () => {
        const raw = `
stores:
  default:
    path: /data/default
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.default?.categoryMode).toBeUndefined();
        }
    });

    it('should reject invalid categoryMode value', () => {
        const raw = `
stores:
  default:
    path: /data/default
    categoryMode: invalid
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.store).toBe('default');
            expect(result.error.field).toBe('categoryMode');
        }
    });

    it('should parse store with nested category hierarchy', () => {
        const raw = `
stores:
  default:
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
            const categories = result.value.stores.default?.categories;
            expect(categories).toBeDefined();
            expect(categories?.standards?.description).toBe('Coding standards');
            expect(categories?.standards?.subcategories?.architecture?.description).toBe('Architecture decisions');
            expect(categories?.standards?.subcategories?.testing?.description).toBe('Testing guidelines');
        }
    });

    it('should parse category without description', () => {
        const raw = `
stores:
  default:
    path: /data/default
    categories:
      todos: {}
`;
        const result = parseConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.stores.default?.categories?.todos).toEqual({});
        }
    });

    it('should parse deeply nested categories', () => {
        const raw = `
stores:
  default:
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
            const level3 = result.value.stores.default?.categories?.level1?.subcategories?.level2?.subcategories?.level3;
            expect(level3?.description).toBe('Third level');
        }
    });

    it('should reject category description exceeding 500 characters', () => {
        const longDescription = 'x'.repeat(501);
        const raw = `
stores:
  default:
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

    it('should round-trip config with categories and categoryMode', () => {
        const original: MergedConfig = {
            settings: getDefaultSettings(),
            stores: {
                default: {
                    path: '/data/default',
                    categoryMode: 'subcategories',
                    categories: {
                        standards: {
                            description: 'Coding standards',
                            subcategories: {
                                architecture: { description: 'Architecture' },
                            },
                        },
                    },
                },
            },
        };
        const serialized = serializeMergedConfig(original);
        expect(serialized.ok()).toBe(true);
        if (!serialized.ok()) return;

        const parsed = parseConfig(serialized.value);
        expect(parsed.ok()).toBe(true);
        if (!parsed.ok()) return;

        expect(parsed.value.stores.default?.categoryMode).toBe('subcategories');
        expect(parsed.value.stores.default?.categories?.standards?.description).toBe('Coding standards');
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
        expect(flattenCategoryPaths(cats)).toEqual([
            'alpha', 'beta',
        ]);
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
        expect(flattenCategoryPaths(cats)).toEqual([
            'a',
            'a/b',
            'a/b/c',
        ]);
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
