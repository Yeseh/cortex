/**
 * Unit tests for explicit store parameter behavior.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ServerConfig } from '../../config.ts';
import { MEMORY_SUBDIR } from '../../config.ts';
import { createTestConfig, createTestDir, registerStore } from './test-utils.ts';
import { addMemoryHandler, type AddMemoryInput } from './add-memory.ts';
import { getMemoryHandler, type GetMemoryInput } from './get-memory.ts';

describe('explicit store parameter', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        const customStorePath = join(testDir, MEMORY_SUBDIR, 'custom');
        await registerStore(testDir, 'my-default-store', customStorePath);

        config.defaultStore = 'my-default-store';
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should use explicit store from input', async () => {
        const addInput: AddMemoryInput = {
            store: 'my-default-store',
            path: 'project/test',
            content: 'Test',
        };

        await addMemoryHandler({ config }, addInput);

        const getInput: GetMemoryInput = {
            store: 'my-default-store',
            path: 'project/test',
        };

        const result = await getMemoryHandler({ config }, getInput);
        expect(result.content[0]!.text).toContain('Test');
    });
});
