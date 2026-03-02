/**
 * Build script for @yeseh/cortex-core.
 *
 * Uses Bun.build() to transpile TypeScript source into JavaScript,
 * resolving path aliases (@/*) in the process. Declaration files (.d.ts)
 * are still emitted by tsc separately.
 */
const entrypoints = [
    './src/index.ts',
    './src/memory/index.ts',
    './src/category/index.ts',
    './src/store/index.ts',
    './src/storage/index.ts',
    './src/testing/index.ts',
];

const result = await Bun.build({
    entrypoints,
    outdir: './dist',
    root: './src',
    target: 'node',
    format: 'esm',
    splitting: false,
    sourcemap: 'external',
    external: ['zod', '@toon-format/toon'],
});

if (!result.success) {
    console.error('Build failed:');
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

console.log(`Built ${result.outputs.length} files to dist/`);
