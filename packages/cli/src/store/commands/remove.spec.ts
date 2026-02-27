/**
 * Unit tests for the store remove command handler.
 *
 * Note: `handleRemove` reads and writes the global config file via `Bun.file()` and
 * `Bun.write()`. These I/O calls are not dependency-injected, so the success
 * path is not testable at the unit level without filesystem mocking (prohibited
 * by project rules). Only the validation paths that throw before any I/O are
 * covered here.
 *
 * Slug normalization behavior: `Slug.from()` normalizes most inputs rather than
 * rejecting them. Only empty/whitespace strings fail `Slug.from()` and produce
 * `InvalidArgumentError`.
 *
 * @module cli/store/commands/remove.spec
 */

import { describe, it } from 'bun:test';
import { handleRemove } from './remove.ts';
import {
    createMockContext,
    expectInvalidArgumentError,
    expectCommanderError,
} from '../../test-helpers.spec.ts';

describe('handleRemove', () => {
    describe('store name validation', () => {
        it('should throw InvalidArgumentError for an empty store name', async () => {
            const { ctx } = createMockContext();

            await expectInvalidArgumentError(
                () => handleRemove(ctx, ''),
                'Store name must be a lowercase slug',
            );
        });

        it('should throw InvalidArgumentError for a whitespace-only store name', async () => {
            const { ctx } = createMockContext();

            await expectInvalidArgumentError(
                () => handleRemove(ctx, '   '),
                'Store name must be a lowercase slug',
            );
        });
    });

    describe('store not found check', () => {
        it('should throw CommanderError when the store does not exist in context', async () => {
            // Provide an empty store registry so any store name fails the check
            const { ctx } = createMockContext({ stores: {} });

            await expectCommanderError(
                () => handleRemove(ctx, 'nonexistent'),
                'STORE_NOT_FOUND',
                'not registered',
            );
        });

        it('should throw CommanderError with the store name included in message', async () => {
            const { ctx } = createMockContext({ stores: {} });

            await expectCommanderError(
                () => handleRemove(ctx, 'my-store'),
                'STORE_NOT_FOUND',
                'my-store',
            );
        });

        it('should throw CommanderError for a valid name not in context', async () => {
            const { ctx } = createMockContext({
                stores: {
                    global: {
                        kind: 'filesystem',
                        categoryMode: 'free',
                        categories: {},
                        properties: { path: '/default/path' },
                    },
                },
            });

            // 'work' is a valid slug but not registered in this context
            await expectCommanderError(() => handleRemove(ctx, 'work'), 'STORE_NOT_FOUND');
        });

        it('should normalize the name before checking for store existence', async () => {
            // Slug.from('WORK') → 'work'; if 'work' is not in stores, STORE_NOT_FOUND
            const { ctx } = createMockContext({ stores: {} });

            await expectCommanderError(() => handleRemove(ctx, 'WORK'), 'STORE_NOT_FOUND');
        });
    });

    // NOTE: The success path (steps 3–6) requires reading and writing the global
    // config file via Bun.file() / Bun.write(). These calls use the hardcoded
    // getDefaultConfigPath() with no injection point, so they cannot be tested
    // at the unit level without filesystem mocking (which is prohibited).
    // The success path should be covered by integration tests.
});
