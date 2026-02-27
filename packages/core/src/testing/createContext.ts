import type { ConfigStores, CortexSettings } from '@/config/types';
import { Cortex } from '@/cortex';
import type { StorageAdapter, ConfigAdapter } from '@/storage';
import type { CortexContext } from '@/types';
import { ok } from '@/result';
import { PassThrough } from 'node:stream';

/** Creates a minimal no-op ConfigAdapter for use in tests. */
const createTestConfigAdapter = (
    stores: ConfigStores,
    settings: CortexSettings
): ConfigAdapter => ({
    path: '/tmp/cortex-test/config.yaml',
    data: null,
    get stores() {
        return stores;
    },
    get settings() {
        return settings;
    },
    initializeConfig: async () => ok(undefined),
    getSettings: async () => ok(settings),
    getStores: async () => ok(stores),
    getStore: async (name: string) => ok(stores[name] ?? null),
    saveStore: async () => ok(undefined),
});

export const testContext = (options: {
    adapter: StorageAdapter;
    storePath: string;
    stdout?: PassThrough;
    stdin?: PassThrough;
    stores?: ConfigStores;
    settings?: CortexSettings;
    now?: () => Date;
}): CortexContext => {
    const cortex = Cortex.init({
        settings: options.settings ?? {},
        stores: options.stores,
        adapterFactory: () => options.adapter,
    });

    const effectiveStores = options.stores ?? {};
    const effectiveSettings = options.settings ?? {};

    return {
        cortex,
        config: createTestConfigAdapter(effectiveStores, effectiveSettings as CortexSettings),
        settings: effectiveSettings as CortexSettings,
        stores: effectiveStores,
        now: options.now ?? (() => new Date('2025-01-01T00:00:00.000Z')),
        stdin: (options.stdin ?? new PassThrough()) as unknown as NodeJS.ReadStream,
        stdout: (options.stdout ?? new PassThrough()) as unknown as NodeJS.WriteStream,
    };
};
