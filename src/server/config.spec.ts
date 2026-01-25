import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { loadServerConfig, serverConfigSchema } from './config.ts';

describe('server config loading', () => {
    // Store original env
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        // Clear all CORTEX_ env vars
        Object.keys(process.env)
            .filter((key) => key.startsWith('CORTEX_'))
            .forEach((key) => delete process.env[key]);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('default values', () => {
        it('should use defaults when no env vars are set', () => {
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.dataPath).toBe('./.cortex-data');
                expect(result.value.port).toBe(3000);
                expect(result.value.host).toBe('0.0.0.0');
                expect(result.value.defaultStore).toBe('default');
                expect(result.value.logLevel).toBe('info');
                expect(result.value.outputFormat).toBe('yaml');
                expect(result.value.autoSummaryThreshold).toBe(500);
            }
        });

        it('should return all default fields in the config object', () => {
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                const keys = Object.keys(result.value).sort();
                expect(keys).toEqual([
                    'autoSummaryThreshold',
                    'dataPath',
                    'defaultStore',
                    'host',
                    'logLevel',
                    'outputFormat',
                    'port',
                ]);
            }
        });
    });

    describe('environment variable parsing', () => {
        it('should read CORTEX_DATA_PATH', () => {
            process.env.CORTEX_DATA_PATH = '/custom/path';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.dataPath).toBe('/custom/path');
            }
        });

        it('should read CORTEX_PORT', () => {
            process.env.CORTEX_PORT = '8080';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.port).toBe(8080);
            }
        });

        it('should read CORTEX_HOST', () => {
            process.env.CORTEX_HOST = '127.0.0.1';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.host).toBe('127.0.0.1');
            }
        });

        it('should read CORTEX_DEFAULT_STORE', () => {
            process.env.CORTEX_DEFAULT_STORE = 'my-store';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.defaultStore).toBe('my-store');
            }
        });

        it('should read CORTEX_LOG_LEVEL', () => {
            process.env.CORTEX_LOG_LEVEL = 'debug';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.logLevel).toBe('debug');
            }
        });

        it('should read CORTEX_OUTPUT_FORMAT', () => {
            process.env.CORTEX_OUTPUT_FORMAT = 'json';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.outputFormat).toBe('json');
            }
        });

        it('should read CORTEX_AUTO_SUMMARY_THRESHOLD', () => {
            process.env.CORTEX_AUTO_SUMMARY_THRESHOLD = '1000';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.autoSummaryThreshold).toBe(1000);
            }
        });

        it('should coerce string port value to number', () => {
            process.env.CORTEX_PORT = '9000';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(typeof result.value.port).toBe('number');
                expect(result.value.port).toBe(9000);
            }
        });

        it('should coerce string threshold value to number', () => {
            process.env.CORTEX_AUTO_SUMMARY_THRESHOLD = '250';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(typeof result.value.autoSummaryThreshold).toBe('number');
                expect(result.value.autoSummaryThreshold).toBe(250);
            }
        });

        it('should parse multiple env vars together', () => {
            process.env.CORTEX_DATA_PATH = '/data';
            process.env.CORTEX_PORT = '4000';
            process.env.CORTEX_HOST = 'localhost';
            process.env.CORTEX_DEFAULT_STORE = 'test-store';
            process.env.CORTEX_LOG_LEVEL = 'warn';
            process.env.CORTEX_OUTPUT_FORMAT = 'json';
            process.env.CORTEX_AUTO_SUMMARY_THRESHOLD = '100';

            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value).toEqual({
                    dataPath: '/data',
                    port: 4000,
                    host: 'localhost',
                    defaultStore: 'test-store',
                    logLevel: 'warn',
                    outputFormat: 'json',
                    autoSummaryThreshold: 100,
                });
            }
        });

        it('should accept zero for autoSummaryThreshold', () => {
            process.env.CORTEX_AUTO_SUMMARY_THRESHOLD = '0';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.autoSummaryThreshold).toBe(0);
            }
        });
    });

    describe('log level validation', () => {
        it('should accept debug log level', () => {
            process.env.CORTEX_LOG_LEVEL = 'debug';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.logLevel).toBe('debug');
            }
        });

        it('should accept info log level', () => {
            process.env.CORTEX_LOG_LEVEL = 'info';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.logLevel).toBe('info');
            }
        });

        it('should accept warn log level', () => {
            process.env.CORTEX_LOG_LEVEL = 'warn';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.logLevel).toBe('warn');
            }
        });

        it('should accept error log level', () => {
            process.env.CORTEX_LOG_LEVEL = 'error';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.logLevel).toBe('error');
            }
        });
    });

    describe('output format validation', () => {
        it('should accept yaml output format', () => {
            process.env.CORTEX_OUTPUT_FORMAT = 'yaml';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.outputFormat).toBe('yaml');
            }
        });

        it('should accept json output format', () => {
            process.env.CORTEX_OUTPUT_FORMAT = 'json';
            const result = loadServerConfig();

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.value.outputFormat).toBe('json');
            }
        });
    });

    describe('validation errors', () => {
        it('should reject negative port', () => {
            process.env.CORTEX_PORT = '-1';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
                expect(result.error.message).toBe('Invalid server configuration.');
                expect(result.error.issues).toBeDefined();
                expect(result.error.issues!.length).toBeGreaterThan(0);
            }
        });

        it('should reject zero port', () => {
            process.env.CORTEX_PORT = '0';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            }
        });

        it('should reject non-integer port', () => {
            process.env.CORTEX_PORT = '3000.5';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            }
        });

        it('should reject non-numeric port', () => {
            process.env.CORTEX_PORT = 'abc';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            }
        });

        it('should reject invalid logLevel', () => {
            process.env.CORTEX_LOG_LEVEL = 'verbose';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
                expect(result.error.issues).toBeDefined();
            }
        });

        it('should reject invalid outputFormat', () => {
            process.env.CORTEX_OUTPUT_FORMAT = 'xml';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
                expect(result.error.issues).toBeDefined();
            }
        });

        it('should reject negative autoSummaryThreshold', () => {
            process.env.CORTEX_AUTO_SUMMARY_THRESHOLD = '-1';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            }
        });

        it('should reject non-integer autoSummaryThreshold', () => {
            process.env.CORTEX_AUTO_SUMMARY_THRESHOLD = '100.5';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            }
        });

        it('should reject non-numeric autoSummaryThreshold', () => {
            process.env.CORTEX_AUTO_SUMMARY_THRESHOLD = 'many';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            }
        });

        it('should include issues array in validation error', () => {
            process.env.CORTEX_PORT = '-1';
            process.env.CORTEX_LOG_LEVEL = 'invalid';

            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.issues).toBeDefined();
                expect(Array.isArray(result.error.issues)).toBe(true);
                expect(result.error.issues!.length).toBeGreaterThanOrEqual(2);
            }
        });
    });

    describe('result type structure', () => {
        it('should return ok: true with value on success', () => {
            const result = loadServerConfig();

            expect(result).toHaveProperty('ok', true);
            expect(result).toHaveProperty('value');
            expect(result).not.toHaveProperty('error');
        });

        it('should return ok: false with error on failure', () => {
            process.env.CORTEX_PORT = 'invalid';
            const result = loadServerConfig();

            expect(result).toHaveProperty('ok', false);
            expect(result).toHaveProperty('error');
            expect(result).not.toHaveProperty('value');
        });

        it('should have error with code and message properties', () => {
            process.env.CORTEX_PORT = 'invalid';
            const result = loadServerConfig();

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error).toHaveProperty('code');
                expect(result.error).toHaveProperty('message');
                expect(result.error).toHaveProperty('issues');
            }
        });
    });
});

describe('serverConfigSchema', () => {
    it('should be a Zod schema object', () => {
        expect(serverConfigSchema).toBeDefined();
        expect(serverConfigSchema.parse).toBeInstanceOf(Function);
        expect(serverConfigSchema.safeParse).toBeInstanceOf(Function);
    });

    it('should parse valid config directly', () => {
        const config = {
            dataPath: '/path',
            port: 5000,
            host: 'localhost',
            defaultStore: 'store',
            logLevel: 'debug' as const,
            outputFormat: 'json' as const,
            autoSummaryThreshold: 100,
        };

        const result = serverConfigSchema.safeParse(config);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual(config);
        }
    });

    it('should apply defaults for missing fields', () => {
        const result = serverConfigSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.dataPath).toBe('./.cortex-data');
            expect(result.data.port).toBe(3000);
            expect(result.data.host).toBe('0.0.0.0');
            expect(result.data.defaultStore).toBe('default');
            expect(result.data.logLevel).toBe('info');
            expect(result.data.outputFormat).toBe('yaml');
            expect(result.data.autoSummaryThreshold).toBe(500);
        }
    });
});
