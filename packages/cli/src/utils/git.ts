import { spawn } from "node:child_process";
import { basename } from "node:path";

/**
 * Executes a git command and returns the trimmed stdout.
 */
export const runGitCommand = (
    args: string[],
    cwd: string,
): Promise<{ ok: true; value: string } | { ok: false }> => {
    return new Promise((resolvePromise) => {
        const proc = spawn('git', args, { cwd });
        let stdout = '';

        proc.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });
        proc.on('close', (code: number | null) => {
            if (code === 0) {
                resolvePromise({ ok: true, value: stdout.trim() });
            }
            else {
                resolvePromise({ ok: false });
            }
        });
        proc.on('error', () => {
            resolvePromise({ ok: false });
        });
    });
};

/**
 * Detects the git repository name from the current working directory.
 *
 * Uses `git rev-parse --show-toplevel` to find the repository root,
 * then extracts the directory name as the repository name.
 *
 * @param cwd - The current working directory to check for git repository
 * @returns The repository directory name, or `null` if not in a git repository
 */
export const detectGitRepoName = async (cwd: string): Promise<string | null> => {
    const result = await runGitCommand([
        'rev-parse', '--show-toplevel',
    ], cwd);
    if (!result.ok) {
        return null;
    }
    return basename(result.value);
};


