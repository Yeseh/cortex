/**
 * Utility for resolving which store to target when no `--store` flag is given.
 *
 * Resolution order (first match wins):
 * 1. Explicit store name provided by the caller (from `--store` flag)
 * 2. Local store – a registered store whose path starts with `<cwd>/.cortex`
 * 3. `settings.defaultStore` from the Cortex config file
 * 4. Hard-coded fallback: `"global"`
 *
 * @module cli/utils/resolve-default-store
 *
 * @example
 * ```typescript
 * // In a command handler:
 * const storeName = resolveDefaultStore(ctx, parentOpts?.store);
 * const storeResult = ctx.cortex.getStore(storeName);
 * ```
 */

import { join } from 'node:path';
import type { CortexContext } from '@yeseh/cortex-core';

/**
 * Resolves the effective store name for a command invocation.
 *
 * When a user runs a command without `--store` in a project directory where
 * they have run `cortex store init`, the local store registered for that
 * directory is automatically selected so they don't have to type `--store`
 * on every command.
 *
 * @param ctx - The current Cortex context (provides `stores`, `settings`, `cwd`)
 * @param explicit - Store name from the `--store` CLI flag (may be undefined)
 * @returns The resolved store name to use
 *
 * @example
 * ```typescript
 * // No --store flag, inside /home/user/my-project with a .cortex store:
 * resolveDefaultStore(ctx, undefined);
 * // → "my-project"  (the store registered at /home/user/my-project/.cortex)
 *
 * // Explicit flag always wins:
 * resolveDefaultStore(ctx, "global");
 * // → "global"
 * ```
 */
export function resolveDefaultStore(ctx: CortexContext, explicit: string | undefined): string {
    // 1. Explicit --store flag wins
    if (explicit) return explicit;

    const cwd = ctx.cwd ?? process.cwd();
    const stores = ctx.stores ?? {};

    // 2. Local store – registered store whose path is the `.cortex` dir in cwd
    //    Both `.cortex` and `.cortex/memory` are accepted to handle both
    //    naming conventions in use across the project.
    const localPaths = [join(cwd, '.cortex'), join(cwd, '.cortex', 'memory')];
    for (const [name, store] of Object.entries(stores)) {
        const storePath = store.properties?.path as string | undefined;
        if (storePath && localPaths.includes(storePath)) {
            return name;
        }
    }

    // 3. settings.defaultStore from config
    const defaultStore = ctx.settings?.defaultStore;
    if (defaultStore) return defaultStore;

    // 4. Hard-coded fallback
    return 'global';
}
