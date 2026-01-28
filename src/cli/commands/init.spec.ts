import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseConfig } from '../../core/config.ts';
import { parseStoreRegistry } from '../../core/store/registry.ts';

const normalizePath = (value: string): string => value.replace(/\\/g, '/');

describe('init CLI command', () => {
    let tempDir: string;
    let runInitCommand: typeof import('./init.ts').runInitCommand;

    const buildOptions = (args: string[]) => ({
        args,
        cwd: tempDir,
    });

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-init-cli-'));

        // Mock homedir to return the temp directory
        mock.module('node:os', () => ({
            homedir: () => tempDir,
        }));

        // Dynamically import init command after mocking
        // Clear module cache to ensure fresh import with mocked homedir
        const initModule = await import('./init.ts');
        runInitCommand = initModule.runInitCommand;
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
        // Restore mocks
        mock.restore();
    });

    it('should initialize with default stores.yaml content', async () => {
        const result = await runInitCommand(buildOptions([]));

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const storesPath = join(tempDir, '.config', 'cortex', 'stores.yaml');
        const storesContent = await readFile(storesPath, 'utf8');
        const parsed = parseStoreRegistry(storesContent);

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) {
            return;
        }

        // Verify 'default' store exists
        expect(parsed.value.default).toBeDefined();
        if (!parsed.value.default) {
            return;
        }

        // Verify the path points to the memory directory
        const expectedMemoryPath = join(tempDir, '.config', 'cortex', 'memory');
        expect(normalizePath(parsed.value.default.path)).toBe(normalizePath(expectedMemoryPath));
    });

    it('should initialize with default config.yaml content', async () => {
        const result = await runInitCommand(buildOptions([]));

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const configPath = join(tempDir, '.config', 'cortex', 'config.yaml');
        const configContent = await readFile(configPath, 'utf8');
        const parsed = parseConfig(configContent);

        expect(parsed.ok).toBe(true);
        if (!parsed.ok) {
            return;
        }

        expect(parsed.value.outputFormat).toBe('yaml');
        expect(parsed.value.autoSummaryThreshold).toBe(10);
        expect(parsed.value.strictLocal).toBe(false);
    });

    it('should create global and projects category directories', async () => {
        const result = await runInitCommand(buildOptions([]));

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        const globalPath = join(tempDir, '.config', 'cortex', 'memory', 'global');
        const projectsPath = join(tempDir, '.config', 'cortex', 'memory', 'projects');

        // Verify directories exist (access resolves to null on success)
        await expect(access(globalPath)).resolves.toBeNull();
        await expect(access(projectsPath)).resolves.toBeNull();

        // Also verify index.yaml exists in each category
        const globalIndexPath = join(globalPath, 'index.yaml');
        const projectsIndexPath = join(projectsPath, 'index.yaml');

        await expect(access(globalIndexPath)).resolves.toBeNull();
        await expect(access(projectsIndexPath)).resolves.toBeNull();
    });

    it('should fail with ALREADY_INITIALIZED when run twice without --force', async () => {
        // First init should succeed
        const firstResult = await runInitCommand(buildOptions([]));
        expect(firstResult.ok).toBe(true);

        // Second init should fail
        const secondResult = await runInitCommand(buildOptions([]));
        expect(secondResult.ok).toBe(false);

        if (!secondResult.ok) {
            expect(secondResult.error.code).toBe('ALREADY_INITIALIZED');
        }
    });

    it('should reinitialize with --force flag', async () => {
        // First init
        const firstResult = await runInitCommand(buildOptions([]));
        expect(firstResult.ok).toBe(true);

        // Modify the config.yaml file
        const configPath = join(tempDir, '.config', 'cortex', 'config.yaml');
        await writeFile(
            configPath,
            'output_format: json\nauto_summary_threshold: 99\nstrict_local: true\n',
            'utf8',
        );

        // Verify modification took effect
        const modifiedContent = await readFile(configPath, 'utf8');
        const modifiedParsed = parseConfig(modifiedContent);
        expect(modifiedParsed.ok).toBe(true);
        if (modifiedParsed.ok) {
            expect(modifiedParsed.value.outputFormat).toBe('json');
            expect(modifiedParsed.value.autoSummaryThreshold).toBe(99);
            expect(modifiedParsed.value.strictLocal).toBe(true);
        }

        // Run init with --force
        const forceResult = await runInitCommand(buildOptions(['--force']));
        expect(forceResult.ok).toBe(true);

        // Verify config.yaml is reset to defaults
        const resetContent = await readFile(configPath, 'utf8');
        const resetParsed = parseConfig(resetContent);

        expect(resetParsed.ok).toBe(true);
        if (resetParsed.ok) {
            expect(resetParsed.value.outputFormat).toBe('yaml');
            expect(resetParsed.value.autoSummaryThreshold).toBe(10);
            expect(resetParsed.value.strictLocal).toBe(false);
        }
    });

    it('should reject unknown flags', async () => {
        const result = await runInitCommand(buildOptions(['--unknown']));

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('--unknown');
        }
    });

    it('should reject positional arguments', async () => {
        const result = await runInitCommand(buildOptions(['some-path']));

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('INVALID_ARGUMENTS');
            expect(result.error.message).toContain('positional');
        }
    });

    it('should accept -f as shorthand for --force', async () => {
        // First init
        const firstResult = await runInitCommand(buildOptions([]));
        expect(firstResult.ok).toBe(true);

        // Run init with -f
        const forceResult = await runInitCommand(buildOptions(['-f']));
        expect(forceResult.ok).toBe(true);
    });

    it('should return correct output payload on success', async () => {
        const result = await runInitCommand(buildOptions([]));

        expect(result.ok).toBe(true);
        if (!result.ok) {
            return;
        }

        expect(result.value.output.kind).toBe('init');
        if (result.value.output.kind === 'init') {
            const expectedPath = join(tempDir, '.config', 'cortex', 'memory');
            expect(normalizePath(result.value.output.value.path)).toBe(normalizePath(expectedPath));
            expect(result.value.output.value.categories).toEqual([
                'global', 'projects',
            ]);
        }
    });
});
