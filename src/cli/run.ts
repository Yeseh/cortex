#!/usr/bin/env bun
/**
 * CLI runner script for integration testing.
 * This script is spawned as a subprocess by the integration tests.
 */

import { runCli } from './index.ts';

const result = await runCli();

if (result.output) {
    const output = result.output.endsWith('\n') ? result.output : `${result.output}\n`;
    process.stdout.write(output);
}

if (result.error) {
    const error = result.error.endsWith('\n') ? result.error : `${result.error}\n`;
    process.stderr.write(error);
}

process.exit(result.exitCode);
