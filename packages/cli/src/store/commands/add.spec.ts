/**
 * Unit tests for the store add command handler.
 *
 * Note: `handleAdd` reads and writes the global config file via `Bun.file()` and
 * `Bun.write()`. These I/O calls are not dependency-injected, so the success
 * path is not testable at the unit level without filesystem mocking (prohibited
 * by project rules). Only the validation paths that throw before any I/O are
 * covered here.
 *
 * Slug normalization behavior: `Slug.from()` normalizes most inputs rather than
 * rejecting them (e.g. 'INVALID' → 'invalid', 'my store' → 'my-store'). Only
 * empty/whitespace strings fail `Slug.from()` and produce `InvalidArgumentError`.
 *
 * @module cli/store/commands/add.spec
 */

import { describe, it, expect } from 'bun:test';
import { handleAdd } from './add.ts';
import {
    createMockContext,
    expectInvalidArgumentError,
    expectCommanderError,
} from '../../test-helpers.spec.ts';

describe('handleAdd', () => {
    describe('store name validation', () => {
        it('should throw InvalidArgumentError for an empty store name', async () => {
            const { ctx } = createMockContext({ stores: {} });

            await expectInvalidArgumentError(
                () => handleAdd(ctx, '', '/some/path'),
                'Store name must be a lowercase slug',
            );
        });

        it('should throw InvalidArgumentError for a whitespace-only store name', async () => {
            const { ctx } = createMockContext({ stores: {} });

            await expectInvalidArgumentError(
                () => handleAdd(ctx, '   ', '/some/path'),
                'Store name must be a lowercase slug',
            );
        });
    });

    describe('store path validation', () => {
        it('should throw InvalidArgumentError for an empty store path', async () => {
            const { ctx } = createMockContext({ stores: {} });

            await expectInvalidArgumentError(
                () => handleAdd(ctx, 'valid-name', ''),
                'Store path is required',
            );
        });

        it('should throw InvalidArgumentError for a whitespace-only store path', async () => {
            const { ctx } = createMockContext({ stores: {} });

            await expectInvalidArgumentError(
                () => handleAdd(ctx, 'valid-name', '   '),
                'Store path is required',
            );
        });
    });

    describe('store already exists check', () => {
        it('should throw CommanderError when the store name already exists in context', async () => {
            // 'default' is pre-registered in the mock context
            const { ctx } = createMockContext({
                stores: {
                    default: {
                        kind: 'filesystem',
                        categoryMode: 'free',
                        categories: {},
                        properties: { path: '/existing/path' },
                    },
                },
            });

            await expectCommanderError(
                () => handleAdd(ctx, 'default', '/new/path'),
                'STORE_ALREADY_EXISTS',
                'already registered',
            );
        });

        it('should throw CommanderError with store name in the error message', async () => {
            const { ctx } = createMockContext({
                stores: {
                    'my-store': {
                        kind: 'filesystem',
                        categoryMode: 'free',
                        categories: {},
                        properties: { path: '/some/path' },
                    },
                },
            });

            await expectCommanderError(
                () => handleAdd(ctx, 'my-store', '/new/path'),
                'STORE_ALREADY_EXISTS',
                'my-store',
            );
        });

        it('should normalize the store name before checking for existence', async () => {
            // Slug.from('MY-STORE') → 'my-store', so 'MY-STORE' matches 'my-store'
            const { ctx } = createMockContext({
                stores: {
                    'my-store': {
                        kind: 'filesystem',
                        categoryMode: 'free',
                        categories: {},
                        properties: { path: '/some/path' },
                    },
                },
            });

            await expectCommanderError(
                () => handleAdd(ctx, 'MY-STORE', '/new/path'),
                'STORE_ALREADY_EXISTS',
            );
        });
    });

    // NOTE: The success path (steps 4–6) requires reading and writing the global
    // config file via Bun.file() / Bun.write(). These calls use the hardcoded
    // getDefaultConfigPath() with no injection point, so they cannot be tested
    // at the unit level without filesystem mocking (which is prohibited).
    // The success path should be covered by integration tests.
});
