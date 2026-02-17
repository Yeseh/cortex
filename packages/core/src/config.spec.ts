import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    getConfigDir,
    getConfigPath,
    getDefaultSettings,
    loadConfig,
    parseConfig,
    parseMergedConfig,
    serializeMergedConfig,
    validateStorePath,
    type MergedConfig,
} from './config.ts';

describe('config parsing', () => {
    it('should parse supported fields', () => {
        const raw = [
            'output_format: json',
            'auto_summary_threshold: 12',
            'strict_local: true',
        ].join('\n');

        const result = parseConfig(raw);

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toEqual({
                outputFormat: 'json',
                autoSummaryThreshold: 12,
                strictLocal: true,
                strict_local: true,
            });
        }
    });

    it('should reject unsupported fields', () => {
        const raw = 'unknown_field: true';

        const result = parseConfig(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.field).toBe('unknown_field');
        }
    });

    it('should reject empty values', () => {
        const raw = 'output_format:    # empty';

        const result = parseConfig(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.field).toBe('output_format');
            expect(result.error.line).toBe(1);
        }
    });

    it('should reject non-integer auto_summary_threshold', () => {
        const raw = 'auto_summary_threshold: 4.5';

        const result = parseConfig(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.field).toBe('auto_summary_threshold');
        }
    });

    it('should reject negative auto_summary_threshold values', () => {
        const raw = 'auto_summary_threshold: -1';

        const result = parseConfig(raw);

        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.field).toBe('auto_summary_threshold');
        }
    });
});

describe('config loading', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-config-tests-'));
        await mkdir(join(tempDir, '.cortex'), { recursive: true });
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should prefer local config values over global config', async () => {
        const globalPath = join(tempDir, 'global-config.yaml');
        const localPath = join(tempDir, '.cortex', 'config.yaml');

        await writeFile(
            globalPath,
            [
                'output_format: yaml',
                'auto_summary_threshold: 7',
                'strict_local: false',
            ].join('\n'),
        );
        await writeFile(localPath, 'output_format: json');

        const result = await loadConfig({
            cwd: tempDir,
            globalConfigPath: globalPath,
            localConfigPath: localPath,
        });

        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toEqual({
                outputFormat: 'json',
                autoSummaryThreshold: 7,
                strictLocal: false,
                strict_local: false,
            });
        }
    });
});

describe('ConfigSettings', () => {
    it('should provide default values', () => {
        const defaults = getDefaultSettings();
        expect(defaults.output_format).toBe('yaml');
        expect(defaults.auto_summary).toBe(false);
        expect(defaults.strict_local).toBe(false);
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
  output_format: json
  auto_summary: true
stores:
  default:
    path: /home/user/.config/cortex/memory
`;
        const result = parseMergedConfig(raw);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings.output_format).toBe('json');
            expect(result.value.settings.auto_summary).toBe(true);
            expect(result.value.settings.strict_local).toBe(false); // default
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
            expect(result.value.settings.output_format).toBe('yaml');
            expect(result.value.settings.auto_summary).toBe(false);
            expect(result.value.settings.strict_local).toBe(false);
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

    it('should reject invalid output_format', () => {
        const raw = `
settings:
  output_format: invalid
`;
        const result = parseMergedConfig(raw);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.field).toBe('output_format');
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
            settings: { output_format: 'json', auto_summary: false, strict_local: true },
            stores: { default: { path: '/data/default' } },
        };
        const result = serializeMergedConfig(config);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value).toContain('output_format: json');
            expect(result.value).toContain('strict_local: true');
            expect(result.value).toContain('path: "/data/default"');
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
            settings: { output_format: 'toon', auto_summary: true, strict_local: false },
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
