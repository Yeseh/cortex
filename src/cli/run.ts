#!/usr/bin/env bun
/**
 * CLI runner script for integration testing.
 * This script is spawned as a subprocess by the integration tests.
 */

import { runCli } from "./index.ts";

const result = await runCli();

if (result.output) {
  console.log(result.output);
}

if (result.error) {
  console.error(result.error);
}

process.exit(result.exitCode);
