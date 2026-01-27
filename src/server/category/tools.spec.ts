/**
 * Unit tests for MCP category tools.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { ServerConfig } from '../config.ts';
import {
    createCategoryHandler,
    setCategoryDescriptionHandler,
    deleteCategoryHandler,
    type CreateCategoryInput,
    type SetCategoryDescriptionInput,
    type DeleteCategoryInput,
} from './tools.ts';

const createTestConfig = (dataPath: string): ServerConfig => ({
    dataPath,
    port: 3000,
    host: '127.0.0.1',
    defaultStore: 'default',
    logLevel: 'info',
    outputFormat: 'yaml',
    autoSummaryThreshold: 500,
});

const createTestDir = async (): Promise<string> => {
    const testDir = join(
        tmpdir(),
        `cortex-cat-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
    return testDir;
};

describe('cortex_create_category tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should create a new category', async () => {
        const input: CreateCategoryInput = {
            path: 'project/cortex',
        };

        const result = await createCategoryHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.path).toBe('project/cortex');
        expect(output.created).toBe(true);
    });

    it('should return created: false for existing category', async () => {
        const input: CreateCategoryInput = { path: 'project/cortex' };

        // Create first time
        await createCategoryHandler({ config }, input);

        // Create again
        const result = await createCategoryHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.created).toBe(false);
    });

    it('should reject empty path', async () => {
        const input = { path: '' };

        await expect(
            createCategoryHandler({ config }, input as CreateCategoryInput)
        ).rejects.toThrow();
    });
});

describe('cortex_set_category_description tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should set description and auto-create category', async () => {
        const input: SetCategoryDescriptionInput = {
            path: 'project/cortex',
            description: 'Cortex memory system',
        };

        const result = await setCategoryDescriptionHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.description).toBe('Cortex memory system');
    });

    it('should reject root category', async () => {
        const input: SetCategoryDescriptionInput = {
            path: 'project',
            description: 'Test',
        };

        await expect(setCategoryDescriptionHandler({ config }, input)).rejects.toThrow(
            /root category/i
        );
    });

    it('should clear description with empty string', async () => {
        // First set a description
        await setCategoryDescriptionHandler(
            { config },
            {
                path: 'project/cortex',
                description: 'Initial',
            }
        );

        // Then clear it
        const result = await setCategoryDescriptionHandler(
            { config },
            {
                path: 'project/cortex',
                description: '',
            }
        );
        const output = JSON.parse(result.content[0]!.text);

        expect(output.description).toBeNull();
    });
});

describe('cortex_delete_category tool', () => {
    let testDir: string;
    let config: ServerConfig;

    beforeEach(async () => {
        testDir = await createTestDir();
        config = createTestConfig(testDir);

        // Create a category to delete
        await createCategoryHandler({ config }, { path: 'project/deleteme' });
    });

    afterEach(async () => {
        await rm(testDir, { recursive: true, force: true });
    });

    it('should delete existing category', async () => {
        const input: DeleteCategoryInput = {
            path: 'project/deleteme',
        };

        const result = await deleteCategoryHandler({ config }, input);
        const output = JSON.parse(result.content[0]!.text);

        expect(output.deleted).toBe(true);
    });

    it('should reject root category deletion', async () => {
        const input: DeleteCategoryInput = {
            path: 'project',
        };

        await expect(deleteCategoryHandler({ config }, input)).rejects.toThrow(/root category/i);
    });

    it('should reject non-existent category', async () => {
        const input: DeleteCategoryInput = {
            path: 'project/nonexistent',
        };

        await expect(deleteCategoryHandler({ config }, input)).rejects.toThrow(/not found/i);
    });
});
