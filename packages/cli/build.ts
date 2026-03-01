/**
 * Build script for @yeseh/cortex-cli.
 *
 * Uses Bun.build() to transpile TypeScript source into JavaScript.
 * Adds a shebang line to the run.js entrypoint so it works as a bin.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const result = await Bun.build({
    entrypoints: ['./src/run.ts', './src/program.ts'],
    outdir: './dist',
    root: './src',
    target: 'node',
    format: 'esm',
    splitting: true,
    sourcemap: 'external',
    external: [
        '@yeseh/cortex-core',
        '@yeseh/cortex-core/*',
        '@yeseh/cortex-storage-fs',
        '@commander-js/extra-typings',
        '@inquirer/prompts',
        '@toon-format/toon',
        'commander',
    ],
});

if (!result.success) {
    console.error('Build failed:');
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

// Add shebang to the CLI entrypoint, replacing any existing one
const runPath = join('dist', 'run.js');
const content = readFileSync(runPath, 'utf-8');
const withoutShebang = content.replace(/^#!.*\n/, '');
writeFileSync(runPath, `#!/usr/bin/env node\n${withoutShebang}`);

console.log(`Built ${result.outputs.length} files to dist/`);
