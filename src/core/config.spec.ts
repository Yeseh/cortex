import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadConfig, parseConfig } from './config.ts';

describe('config parsing', () => {
    it('should parse supported fields', () => {
        const raw = [
            'output_format: json',
            'auto_summary_threshold: 12',
            'strict_local: true',
        ].join('\n');

        const result = parseConfig(raw);

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual({
                outputFormat: 'json',
                autoSummaryThreshold: 12,
                strictLocal: true,
                strict_local: true,
            });
        }
    });

    it('should reject unsupported fields', () => {
        const raw = 'unknown_field: true';

        const result = parseConfig(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.field).toBe('unknown_field');
        }
    });

    it('should reject empty values', () => {
        const raw = 'output_format:    # empty';

        const result = parseConfig(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.field).toBe('output_format');
            expect(result.error.line).toBe(1);
        }
    });

    it('should reject non-integer auto_summary_threshold', () => {
        const raw = 'auto_summary_threshold: 4.5';

        const result = parseConfig(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.field).toBe('auto_summary_threshold');
        }
    });

    it('should reject negative auto_summary_threshold values', () => {
        const raw = 'auto_summary_threshold: -1';

        const result = parseConfig(raw);

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('CONFIG_VALIDATION_FAILED');
            expect(result.error.field).toBe('auto_summary_threshold');
        }
    });
});

describe('config loading', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'cortex-config-tests-'));
        await mkdir(join(tempDir, '.cortex'), { recursive: true });
    });

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('should prefer local config values over global config', async () => {
        const globalPath = join(tempDir, 'global-config.yaml');
        const localPath = join(tempDir, '.cortex', 'config.yaml');

        await writeFile(
            globalPath,
            ['output_format: yaml', 'auto_summary_threshold: 7', 'strict_local: false'].join('\n')
        );
        await writeFile(localPath, 'output_format: json');

        const result = await loadConfig({
            cwd: tempDir,
            globalConfigPath: globalPath,
            localConfigPath: localPath,
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value).toEqual({
                outputFormat: 'json',
                autoSummaryThreshold: 7,
                strictLocal: false,
                strict_local: false,
            });
        }
    });
});
