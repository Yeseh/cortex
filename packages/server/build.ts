/**
 * Build script for @yeseh/cortex-server.
 *
 * Uses Bun.build() to transpile TypeScript source into JavaScript.
 * Adds a shebang line to the index.js entrypoint so it works as a bin.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
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
        '@modelcontextprotocol/sdk',
        '@modelcontextprotocol/sdk/*',
        '@opentelemetry/*',
        'zod',
    ],
});

if (!result.success) {
    console.error('Build failed:');
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

// Add shebang to the server entrypoint, replacing any existing one
const indexPath = join('dist', 'index.js');
const content = readFileSync(indexPath, 'utf-8');
const withoutShebang = content.replace(/^#!.*\n/, '');
writeFileSync(indexPath, `#!/usr/bin/env node\n${withoutShebang}`);

console.log(`Built ${result.outputs.length} files to dist/`);
