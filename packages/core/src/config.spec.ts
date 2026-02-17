import { afterEach, describe, expect, it } from 'bun:test';

import {
    getConfigDir,
    getConfigPath,
    getDefaultSettings,
    parseMergedConfig,
    serializeMergedConfig,
    validateStorePath,
    type MergedConfig,
} from './config.ts';

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
        const result = parseMergedConfig(raw);
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
        const result = parseMergedConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings.outputFormat).toBe('yaml');
            expect(result.value.settings.autoSummaryThreshold).toBe(0);
            expect(result.value.settings.strictLocal).toBe(false);
        }
    });

    it('should parse empty config', () => {
        const result = parseMergedConfig('');
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
        const result = parseMergedConfig(raw);
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
        const result = parseMergedConfig(raw);
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
        const result = parseMergedConfig(raw);
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

        const parsed = parseMergedConfig(serialized.value);
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
