import type { ConfigStores, CortexSettings } from "@/config/types";
import { Cortex } from "@/cortex";
import type { StorageAdapter } from "@/storage";
import type { CortexContext } from "@/types";
import {PassThrough} from "node:stream";

export const testContext = (options: {
    adapter: StorageAdapter;
    storePath: string;
    stdout?: PassThrough;
    stdin?: PassThrough;
    stores?: ConfigStores
    settings?: CortexSettings;
    now?: () => Date;
}): CortexContext => {
    const cortex = Cortex.init({
        settings: options.settings ?? {},
        stores: options.stores,
        adapterFactory: () => options.adapter,
    });

    return {
        cortex,
        settings: options.settings ?? {},
        stores: options.stores ?? {},
        now: options.now ?? (() => new Date('2025-01-01T00:00:00.000Z')),
        stdin: (options.stdin ?? new PassThrough()) as unknown as NodeJS.ReadStream,
        stdout: (options.stdout ?? new PassThrough()) as unknown as NodeJS.WriteStream,
    };
};