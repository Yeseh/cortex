/**
 * Build script for @yeseh/cortex-storage-fs.
 *
 * Uses Bun.build() to transpile TypeScript source into JavaScript.
 */
const result = await Bun.build({
    entrypoints: ['./src/index.ts'],
    outdir: './dist',
    root: './src',
    target: 'bun',
    format: 'esm',
    splitting: true,
    sourcemap: 'external',
    external: ['@yeseh/cortex-core', '@yeseh/cortex-core/*'],
});

if (!result.success) {
    console.error('Build failed:');
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

console.log(`Built ${result.outputs.length} files to dist/`);
