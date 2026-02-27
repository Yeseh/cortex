import { describe, expect, it, mock } from 'bun:test';
import { CommanderError } from '@commander-js/extra-typings';
import { PassThrough } from 'node:stream';
import { err, ok, type ConfigStore, type CortexContext } from '@yeseh/cortex-core';

import { handleInit } from './init.ts';

const existingGlobalStore: ConfigStore = {
    kind: 'filesystem',
    categoryMode: 'free',
    categories: {},
    properties: { path: '/tmp/existing-global-store' },
};

const createContext = (config: CortexContext['config']): { ctx: CortexContext; stdout: PassThrough } => {
    const stdout = new PassThrough();
    let output = '';

    stdout.on('data', (chunk: Buffer | string) => {
        output += chunk.toString();
    });

    const ctx = {
        cortex: {} as CortexContext['cortex'],
        config,
        settings: {},
        stores: {},
        now: () => new Date('2025-01-01T00:00:00.000Z'),
        stdin: new PassThrough() as unknown as NodeJS.ReadStream,
        stdout: stdout as unknown as NodeJS.WriteStream,
    } as CortexContext;

    return {
        ctx,
        stdout: Object.assign(stdout, {
            getOutput: () => output,
        }) as PassThrough,
    };
};

describe('handleInit', () => {
    it('should initialize config and create global store when missing', async () => {
        const initializeConfig = mock(async () => ok(undefined));
        const getStore = mock(async () => ok(null));
        const saveStore = mock(async () => ok(undefined));

        const { ctx, stdout } = createContext({
            path: '/tmp/test-config.yaml',
            data: null,
            stores: null,
            settings: null,
            initializeConfig,
            getSettings: async () => ok({}),
            getStores: async () => ok({}),
            getStore,
            saveStore,
        });

        await handleInit(ctx, { format: 'json' });

        expect(initializeConfig).toHaveBeenCalledTimes(1);
        expect(saveStore).toHaveBeenCalledTimes(1);

        const output = (stdout as PassThrough & { getOutput: () => string }).getOutput();
        const parsed = JSON.parse(output) as { value: { path: string } };
        expect(parsed.value.path).toContain('/.config/cortex/memory');
    });

    it('should throw when global store already exists without force', async () => {
        const saveStore = mock(async () => ok(undefined));

        const { ctx } = createContext({
            path: '/tmp/test-config.yaml',
            data: null,
            stores: null,
            settings: null,
            initializeConfig: async () => ok(undefined),
            getSettings: async () => ok({}),
            getStores: async () => ok({}),
            getStore: async () => ok(existingGlobalStore),
            saveStore,
        });

        await expect(handleInit(ctx, { format: 'yaml' })).rejects.toThrow(CommanderError);
        expect(saveStore).not.toHaveBeenCalled();
    });

    it('should allow force and skip saveStore when global store already exists', async () => {
        const saveStore = mock(async () => ok(undefined));

        const { ctx } = createContext({
            path: '/tmp/test-config.yaml',
            data: null,
            stores: null,
            settings: null,
            initializeConfig: async () => ok(undefined),
            getSettings: async () => ok({}),
            getStores: async () => ok({}),
            getStore: async () => ok(existingGlobalStore),
            saveStore,
        });

        await expect(handleInit(ctx, { force: true, format: 'yaml' })).resolves.toBeUndefined();
        expect(saveStore).not.toHaveBeenCalled();
    });

    it('should surface config initialization failures', async () => {
        const { ctx } = createContext({
            path: '/tmp/test-config.yaml',
            data: null,
            stores: null,
            settings: null,
            initializeConfig: async () =>
                err({
                    code: 'CONFIG_WRITE_FAILED',
                    message: 'Failed to write config file',
                }),
            getSettings: async () => ok({}),
            getStores: async () => ok({}),
            getStore: async () => ok(null),
            saveStore: async () => ok(undefined),
        });

        await expect(handleInit(ctx, { format: 'yaml' })).rejects.toThrow(CommanderError);
    });
});
