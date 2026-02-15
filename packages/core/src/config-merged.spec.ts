import { describe, expect, it } from 'bun:test';
import { parseMergedConfig, serializeMergedConfig, DEFAULT_CORTEX_SETTINGS } from './config.ts';

describe('parseMergedConfig', () => {
    it('should parse config with both settings and stores', () => {
        const yaml = `
settings:
  output_format: json
  auto_summary: true
  strict_local: false

stores:
  default:
    path: /home/user/.config/cortex/memory
    description: Global memory
  project:
    path: /home/user/project/.cortex/memory
`;
        const result = parseMergedConfig(yaml);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings.outputFormat).toBe('json');
            expect(result.value.settings.autoSummary).toBe(true);
            expect(result.value.settings.strictLocal).toBe(false);
            expect(result.value.stores.default?.path).toBe('/home/user/.config/cortex/memory');
            expect(result.value.stores.default?.description).toBe('Global memory');
            expect(result.value.stores.project?.path).toBe('/home/user/project/.cortex/memory');
        }
    });

    it('should use default settings when settings section is omitted', () => {
        const yaml = `
stores:
  default:
    path: /tmp/store
`;
        const result = parseMergedConfig(yaml);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings).toEqual(DEFAULT_CORTEX_SETTINGS);
        }
    });

    it('should return empty registry when stores section is omitted', () => {
        const yaml = `
settings:
  output_format: toon
`;
        const result = parseMergedConfig(yaml);
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings.outputFormat).toBe('toon');
            expect(result.value.stores).toEqual({});
        }
    });

    it('should handle empty config file', () => {
        const result = parseMergedConfig('');
        expect(result.ok()).toBe(true);
        if (result.ok()) {
            expect(result.value.settings).toEqual(DEFAULT_CORTEX_SETTINGS);
            expect(result.value.stores).toEqual({});
        }
    });

    it('should reject relative store paths', () => {
        const yaml = `
stores:
  local:
    path: ./memory
`;
        const result = parseMergedConfig(yaml);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('INVALID_STORE_PATH');
            expect(result.error.message).toContain('must be absolute');
        }
    });

    it('should reject invalid output_format', () => {
        const yaml = `
settings:
  output_format: invalid
`;
        const result = parseMergedConfig(yaml);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_PARSE_FAILED');
            expect(result.error.field).toBe('settings.output_format');
        }
    });

    it('should reject store without path', () => {
        const yaml = `
stores:
  broken:
    description: Missing path
`;
        const result = parseMergedConfig(yaml);
        expect(result.ok()).toBe(false);
        if (!result.ok()) {
            expect(result.error.code).toBe('CONFIG_PARSE_FAILED');
            expect(result.error.message).toContain('non-empty path');
        }
    });
});

describe('serializeMergedConfig', () => {
    it('should serialize config with settings and stores', () => {
        const config = {
            settings: {
                outputFormat: 'json' as const,
                autoSummary: true,
                strictLocal: false,
            },
            stores: {
                default: { path: '/tmp/default' },
                project: { path: '/tmp/project', description: 'Project store' },
            },
        };
        const yaml = serializeMergedConfig(config);
        expect(yaml).toContain('output_format: json');
        expect(yaml).toContain('auto_summary: true');
        expect(yaml).toContain('path: /tmp/default');
        expect(yaml).toContain('description: Project store');
    });

    it('should omit settings section when all defaults', () => {
        const config = {
            settings: { ...DEFAULT_CORTEX_SETTINGS },
            stores: { default: { path: '/tmp/store' } },
        };
        const yaml = serializeMergedConfig(config);
        expect(yaml).not.toContain('settings:');
        expect(yaml).toContain('stores:');
    });

    it('should omit stores section when empty', () => {
        const config = {
            settings: { outputFormat: 'toon' as const, autoSummary: false, strictLocal: false },
            stores: {},
        };
        const yaml = serializeMergedConfig(config);
        expect(yaml).toContain('settings:');
        expect(yaml).not.toContain('stores:');
    });
});
