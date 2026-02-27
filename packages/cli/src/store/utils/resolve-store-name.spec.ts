import { afterEach, describe, expect, it } from 'bun:test';
import { InvalidArgumentError } from '@commander-js/extra-typings';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { runGitCommand } from '../../utils/git.ts';
import { resolveStoreName } from './resolve-store-name.ts';

const THIS_DIR = import.meta.dir;

describe('resolveStoreName', () => {
    const createdDirs: string[] = [];

    afterEach(async () => {
        for (const dir of createdDirs.splice(0)) {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it('should prioritize explicit name when provided', async () => {
        const name = await resolveStoreName('/any/path', 'My Project Store!');
        expect(name).toBe('my-project-store');
    });

    it('should throw InvalidArgumentError for invalid explicit name', async () => {
        await expect(resolveStoreName('/any/path', '   ')).rejects.toThrow(InvalidArgumentError);
    });

    it('should derive store name from git toplevel basename', async () => {
        const toplevelResult = await runGitCommand([
            'rev-parse', '--show-toplevel',
        ], THIS_DIR);
        if (!toplevelResult.ok) {
            return;
        }

        const expected = basename(toplevelResult.value)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        const resolved = await resolveStoreName(THIS_DIR);
        expect(resolved).toBe(expected);
    });

    it('should fall back to folder basename when not in a git repository', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'Resolve Name Folder '));
        createdDirs.push(dir);

        const resolved = await resolveStoreName(dir);
        expect(resolved).toMatch(/^resolve-name-folder-/);
    });

    it('should return an empty slug when folder basename normalizes to nothing', async () => {
        const dir = join(tmpdir(), '!!!');
        await mkdir(dir, { recursive: true });
        createdDirs.push(dir);

        await expect(resolveStoreName(dir)).resolves.toBe('');
    });
});
