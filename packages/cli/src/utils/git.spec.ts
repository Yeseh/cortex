/**
 * Unit tests for utils/git.ts
 *
 * @module cli/utils/git.spec
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { runGitCommand, detectGitRepoName } from './git';

// The spec file lives inside a git worktree — use its own directory as a real
// git repo for tests that require one.
const THIS_DIR = import.meta.dir;

// ============================================================================
// Temp dir management
// ============================================================================

let tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'cortex-git-test-'));
    tempDirs.push(dir);
    return dir;
}

afterEach(async () => {
    for (const dir of tempDirs) {
        await rm(dir, { recursive: true, force: true });
    }
    tempDirs = [];
});

// ============================================================================
// runGitCommand
// ============================================================================

describe('runGitCommand', () => {
    it('should return ok with stdout for a valid git command', async () => {
        const result = await runGitCommand([
            'rev-parse', '--show-toplevel',
        ], THIS_DIR);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(typeof result.value).toBe('string');
            expect(result.value.length).toBeGreaterThan(0);
        }
    });

    it('should return {ok: false} for an invalid git command', async () => {
        const result = await runGitCommand(['not-a-real-subcommand-xyz'], THIS_DIR);
        expect(result.ok).toBe(false);
    });

    it('should return {ok: false} in a non-git directory', async () => {
        const nonGitDir = await makeTempDir();
        const result = await runGitCommand([
            'rev-parse', '--show-toplevel',
        ], nonGitDir);
        expect(result.ok).toBe(false);
    });
});

// ============================================================================
// detectGitRepoName
// ============================================================================

describe('detectGitRepoName', () => {
    it('should return a non-empty string for a git repo', async () => {
        const name = await detectGitRepoName(THIS_DIR);
        expect(typeof name).toBe('string');
        expect((name ?? '').length).toBeGreaterThan(0);
    });

    it('should return the toplevel directory basename for a git repo', async () => {
        // Get the toplevel via git, then compare what detectGitRepoName returns
        const toplevelResult = await runGitCommand([
            'rev-parse', '--show-toplevel',
        ], THIS_DIR);
        expect(toplevelResult.ok).toBe(true);
        if (toplevelResult.ok) {
            const expectedName = basename(toplevelResult.value);
            const name = await detectGitRepoName(THIS_DIR);
            expect(name).toBe(expectedName);
        }
    });

    it('should return null for a non-git directory', async () => {
        const nonGitDir = await makeTempDir();
        const name = await detectGitRepoName(nonGitDir);
        expect(name).toBeNull();
    });
});
