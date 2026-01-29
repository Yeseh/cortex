#!/usr/bin/env bun
/**
 * CLI runner script for integration testing.
 * This script is spawned as a subprocess by the integration tests.
 */

import { runProgram } from './program.ts';

runProgram();
