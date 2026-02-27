/**
 * Integration tests for the `createServer` entry point.
 *
 * These tests exercise the full server lifecycle — config loading, context
 * creation, MCP tool registration, and HTTP server startup — using real temp
 * directories and a unique port per test. No module-level mocks are used.
 *
 * NOTE: `packages/server/src/context.ts` has a known bug where the
 * `adapterFactory` passes the store *name* (e.g. `'default'`) as
 * `rootDirectory` to `FilesystemStorageAdapter` instead of looking up the
 * path from `config.stores[name].properties.path`. As a result the adapter
 * resolves the store root as `resolve(storeName)` = `cwd/<storeName>`.
 *
 * The successful-startup tests work around this by temporarily changing
 * `process.cwd()` to the temp directory so that `resolve('default')` resolves
 * to `<tempDir>/default`, and ensuring that directory exists.
 *
 * @module server/index.spec
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from './index.ts';
import { withEnv } from './test-helpers.spec.ts';

// ---------------------------------------------------------------------------
// Port management — each test uses a unique port to avoid binding conflicts
// ---------------------------------------------------------------------------
const BASE_TEST_PORT = 19800;
let portCounter = 0;
const nextPort = () => BASE_TEST_PORT + portCounter++;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Prepares a temp directory so `createServer()` can start successfully.
 *
 * Due to the bug in `context.ts` where the adapter factory uses the store
 * *name* as `rootDirectory`, the actual store path that gets used is
 * `path.resolve(storeName)` from wherever cwd is at the time.
 *
 * This helper therefore creates `<baseDir>/<storeName>` so that when we
 * `chdir` to `baseDir` before calling `createServer`, the adapter resolves to
 * the right location.
 *
 * It also writes a `config.yaml` in `baseDir` so context creation reads an
 * existing config rather than auto-generating one.
 */
async function initTestDataDir(baseDir: string, storeName = 'default'): Promise<void> {
    // The broken adapter resolves storeName relative to cwd (which will be
    // baseDir when we call createServer). Create the store directory there.
    const storeDir = join(baseDir, storeName);
    await mkdir(storeDir, { recursive: true });

    // Write config.yaml so context reads an existing config file.
    // Use a relative path for the store path (matches what context.ts does).
    const configYaml = [
        'settings:',
        '  outputFormat: yaml',
        `  defaultStore: ${storeName}`,
        'stores:',
        `  ${storeName}:`,
        '    kind: filesystem',
        '    categoryMode: free',
        '    categories: {}',
        '    properties:',
        `      path: ${storeName}`,
    ].join('\n');
    await writeFile(join(baseDir, 'config.yaml'), configYaml, 'utf8');
}

/**
 * Runs `fn` with `process.cwd()` temporarily changed to `dir`.
 * Always restores the original cwd, even on error.
 */
async function withCwd<T>(dir: string, fn: () => Promise<T>): Promise<T> {
    const orig = process.cwd();
    process.chdir(dir);
    try {
        return await fn();
    } finally {
        process.chdir(orig);
    }
}

/** Create a temp dir, call `fn`, always clean up. */
async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
    const dir = await mkdtemp(join(tmpdir(), 'cortex-server-test-'));
    try {
        return await fn(dir);
    } finally {
        // Restore cwd first in case fn left it pointing inside dir
        try {
            process.chdir(tmpdir());
        } catch {
            /* ignore */
        }
        await rm(dir, { recursive: true, force: true });
    }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('createServer', () => {
    // Snapshot and restore all CORTEX_* env vars around every test.
    let savedEnv: Record<string, string | undefined>;
    let savedCwd: string;

    beforeEach(() => {
        savedCwd = process.cwd();
        savedEnv = {};
        for (const key of Object.keys(process.env).filter((k) => k.startsWith('CORTEX_'))) {
            savedEnv[key] = process.env[key];
            Reflect.deleteProperty(process.env, key);
        }
    });

    afterEach(() => {
        // Restore cwd if any test changed it
        try {
            process.chdir(savedCwd);
        } catch {
            /* ignore */
        }

        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) {
                Reflect.deleteProperty(process.env, key);
            } else {
                process.env[key] = value;
            }
        }
    });

    // -----------------------------------------------------------------------
    // CONFIG_INVALID — loadServerConfig() returns an error
    // -----------------------------------------------------------------------

    describe('CONFIG_INVALID error', () => {
        it('should return CONFIG_INVALID when CORTEX_LOG_LEVEL is invalid', async () => {
            const result = await withEnv(
                { CORTEX_LOG_LEVEL: 'verbose' }, // not in enum [debug, info, warn, error]
                () => createServer()
            );

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('CONFIG_INVALID');
                expect(typeof result.error.message).toBe('string');
                expect(result.error.message.length).toBeGreaterThan(0);
            }
        });

        it('should return CONFIG_INVALID when CORTEX_PORT is non-numeric', async () => {
            const result = await withEnv({ CORTEX_PORT: 'not-a-port' }, () => createServer());

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('CONFIG_INVALID');
            }
        });

        it('should return CONFIG_INVALID when CORTEX_OUTPUT_FORMAT is invalid', async () => {
            const result = await withEnv({ CORTEX_OUTPUT_FORMAT: 'xml' }, () => createServer());

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('CONFIG_INVALID');
            }
        });

        it('should include a cause Error in the CONFIG_INVALID result', async () => {
            const result = await withEnv({ CORTEX_LOG_LEVEL: 'trace' }, () => createServer());

            expect(result.ok()).toBe(false);
            if (!result.ok()) {
                expect(result.error.code).toBe('CONFIG_INVALID');
                expect(result.error.cause).toBeInstanceOf(Error);
            }
        });
    });

    // -----------------------------------------------------------------------
    // SERVER_START_FAILED — createCortexContext returns err (impossible path)
    //
    // context.ts now returns err() for filesystem errors rather than throwing,
    // so createServer returns err(SERVER_START_FAILED) rather than rejecting.
    // -----------------------------------------------------------------------

    describe('context creation failure on impossible path', () => {
        it('should return err when CORTEX_DATA_PATH cannot be created', async () => {
            // /dev/null is a character device — mkdir inside it throws ENOTDIR.
            const result = await withEnv(
                {
                    CORTEX_DATA_PATH: '/dev/null/impossible-nested-path',
                    CORTEX_PORT: String(nextPort()),
                },
                () => createServer()
            );
            expect(result.ok()).toBe(false);
        });

        it('should return err when data path nests inside an existing file', async () => {
            // /etc/hostname is a regular file on Linux — mkdir inside it throws.
            const result = await withEnv(
                {
                    CORTEX_DATA_PATH: '/etc/hostname/cortex-should-fail',
                    CORTEX_PORT: String(nextPort()),
                },
                () => createServer()
            );
            expect(result.ok()).toBe(false);
        });
    });

    // -----------------------------------------------------------------------
    // Successful startup
    //
    // We temporarily change process.cwd() to the temp dir so that the
    // broken adapter factory (resolve('default')) resolves to the right place.
    // -----------------------------------------------------------------------

    describe('successful startup', () => {
        it('should return ok with server, mcpContext, config and close', async () => {
            await withTempDir(async (testDir) => {
                await initTestDataDir(testDir);
                const port = nextPort();

                const result = await withCwd(testDir, () =>
                    withEnv({ CORTEX_DATA_PATH: testDir, CORTEX_PORT: String(port) }, () =>
                        createServer()
                    )
                );

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    const { server, mcpContext, config, close } = result.value;
                    expect(server).toBeDefined();
                    expect(mcpContext).toBeDefined();
                    expect(config).toBeDefined();
                    expect(typeof close).toBe('function');
                    await close();
                }
            });
        });

        it('should resolve config values from environment variables', async () => {
            await withTempDir(async (testDir) => {
                await initTestDataDir(testDir);
                const port = nextPort();

                const result = await withCwd(testDir, () =>
                    withEnv(
                        {
                            CORTEX_DATA_PATH: testDir,
                            CORTEX_PORT: String(port),
                            CORTEX_LOG_LEVEL: 'warn',
                            CORTEX_OUTPUT_FORMAT: 'json',
                            CORTEX_DEFAULT_STORE: 'default',
                        },
                        () => createServer()
                    )
                );

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    const { config, close } = result.value;
                    expect(config.dataPath).toBe(testDir);
                    expect(config.port).toBe(port);
                    expect(config.logLevel).toBe('warn');
                    expect(config.outputFormat).toBe('json');
                    expect(config.defaultStore).toBe('default');
                    await close();
                }
            });
        });

        it('should expose an mcpContext with a server and transport', async () => {
            await withTempDir(async (testDir) => {
                await initTestDataDir(testDir);
                const port = nextPort();

                const result = await withCwd(testDir, () =>
                    withEnv({ CORTEX_DATA_PATH: testDir, CORTEX_PORT: String(port) }, () =>
                        createServer()
                    )
                );

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    const { mcpContext, close } = result.value;
                    expect(mcpContext.server).toBeDefined();
                    expect(mcpContext.transport).toBeDefined();
                    await close();
                }
            });
        });

        it('should bind the HTTP server to the configured port', async () => {
            await withTempDir(async (testDir) => {
                await initTestDataDir(testDir);
                const port = nextPort();

                const result = await withCwd(testDir, () =>
                    withEnv({ CORTEX_DATA_PATH: testDir, CORTEX_PORT: String(port) }, () =>
                        createServer()
                    )
                );

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    const { server, close } = result.value;
                    // Bun.serve sets server.port to the actual bound port
                    expect(server.port).toBe(port);
                    await close();
                }
            });
        });

        it('should close cleanly without throwing', async () => {
            await withTempDir(async (testDir) => {
                await initTestDataDir(testDir);
                const port = nextPort();

                const result = await withCwd(testDir, () =>
                    withEnv({ CORTEX_DATA_PATH: testDir, CORTEX_PORT: String(port) }, () =>
                        createServer()
                    )
                );

                expect(result.ok()).toBe(true);
                if (result.ok()) {
                    // close() must resolve to undefined and must not throw
                    await expect(result.value.close()).resolves.toBeUndefined();
                }
            });
        });
    });
});
