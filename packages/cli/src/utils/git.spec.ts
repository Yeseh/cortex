/**
 * Unit tests for utils/git.ts
 *
 * @module cli/utils/git.spec
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runGitCommand, detectGitRepoName } from './git';

// The worktree directory is a real git worktree - rev-parse will return this path
const WORKTREE_DIR = '/home/jesse/repo/cortex/.worktrees/cli-unit-tests';
const EXPECTED_REPO_NAME = 'cli-unit-tests';

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
        ], WORKTREE_DIR);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(typeof result.value).toBe('string');
            expect(result.value.length).toBeGreaterThan(0);
        }
    });

    it('should return {ok: false} for an invalid git command', async () => {
        const result = await runGitCommand(['not-a-real-subcommand-xyz'], WORKTREE_DIR);
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
    it('should return the repo directory name for a git repo', async () => {
        const name = await detectGitRepoName(WORKTREE_DIR);
        expect(name).toBe(EXPECTED_REPO_NAME);
    });

    it('should return null for a non-git directory', async () => {
        const nonGitDir = await makeTempDir();
        const name = await detectGitRepoName(nonGitDir);
        expect(name).toBeNull();
    });
});
