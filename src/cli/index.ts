/**
 * CLI command entrypoint routing for Cortex.
 */

import type { Result } from "../core/types.ts";
import { loadConfig } from "../core/config.ts";
import { resolveStore } from "../store/store.ts";
import { runReindexCommand } from "./commands/reindex.ts";
import { runAddCommand } from "./commands/add.ts";
import { runUpdateCommand } from "./commands/update.ts";

export interface CliRunResult {
  exitCode: number;
  output?: string;
  error?: string;
}

export interface CliRunOptions {
  args?: string[];
  cwd?: string;
  globalStorePath?: string;
}

export interface CliRunError {
  code:
    | "INVALID_COMMAND"
    | "CONFIG_LOAD_FAILED"
    | "STORE_RESOLUTION_FAILED"
    | "REINDEX_FAILED"
    | "ADD_FAILED"
    | "UPDATE_FAILED";
  message: string;
  cause?: unknown;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const formatError = (error: CliRunError): CliRunResult => ({
  exitCode: 1,
  error: error.message,
});

const parseStoreFlag = (args: string[]): { store?: string; remaining: string[] } => {
  const remaining: string[] = [];
  let store: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value) {
      continue;
    }
    if (value === "--store") {
      const candidate = args[index + 1];
      if (candidate) {
        store = candidate;
        index += 1;
        continue;
      }
      store = "";
      continue;
    }
    remaining.push(value);
  }

  return { store, remaining };
};

const parseGlobalStorePath = (args: string[]): { globalStorePath?: string; remaining: string[] } => {
  const remaining: string[] = [];
  let globalStorePath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value) {
      continue;
    }
    if (value === "--global-store") {
      const candidate = args[index + 1];
      if (candidate) {
        globalStorePath = candidate;
        index += 1;
        continue;
      }
      globalStorePath = "";
      continue;
    }
    remaining.push(value);
  }

  return { globalStorePath, remaining };
};

const toCliError = (code: CliRunError["code"], message: string, cause?: unknown): CliRunError => ({
  code,
  message,
  cause,
});

const resolveStoreRoot = async (
  args: string[],
  cwd: string,
  globalStorePath: string
): Promise<Result<{ root: string; remainingArgs: string[] }, CliRunError>> => {
  const configResult = await loadConfig({ cwd });
  if (!configResult.ok) {
    return err(
      toCliError(
        "CONFIG_LOAD_FAILED",
        `Failed to load config: ${configResult.error.message}`,
        configResult.error
      )
    );
  }

  const parsedStore = parseStoreFlag(args);
  if (parsedStore.store === "") {
    return err(
      toCliError("STORE_RESOLUTION_FAILED", "--store requires a value.")
    );
  }
  const storeResolution = await resolveStore({
    cwd,
    globalStorePath,
    config: configResult.value,
  });
  if (!storeResolution.ok) {
    return err(
      toCliError(
        "STORE_RESOLUTION_FAILED",
        storeResolution.error.message,
        storeResolution.error
      )
    );
  }

  if (parsedStore.store) {
    return err(
      toCliError(
        "STORE_RESOLUTION_FAILED",
        `Named store '${parsedStore.store}' is not supported yet.`,
        { store: parsedStore.store }
      )
    );
  }

  return ok({ root: storeResolution.value.root, remainingArgs: parsedStore.remaining });
};

const runCommandWithStore = async (
  args: string[],
  cwd: string,
  globalStorePath: string,
  command: "reindex" | "add" | "update"
): Promise<CliRunResult> => {
  const storeRootResult = await resolveStoreRoot(args, cwd, globalStorePath);
  if (!storeRootResult.ok) {
    return formatError(storeRootResult.error);
  }
  const root = storeRootResult.value.root;
  const remainingArgs = storeRootResult.value.remainingArgs;
  if (command === "reindex") {
    const reindexResult = await runReindexCommand({
      storeRoot: root,
      args: remainingArgs,
    });
    if (!reindexResult.ok) {
      return formatError(
        toCliError("REINDEX_FAILED", reindexResult.error.message, reindexResult.error)
      );
    }
    return { exitCode: 0, output: reindexResult.value.message };
  }
  if (command === "add") {
    const addResult = await runAddCommand({
      storeRoot: root,
      args: remainingArgs,
      stdin: process.stdin,
    });
    if (!addResult.ok) {
      return formatError(toCliError("ADD_FAILED", addResult.error.message, addResult.error));
    }
    return {
      exitCode: 0,
      output: `Add memory ${addResult.value.path} (${addResult.value.source}).`,
    };
  }
  const updateResult = await runUpdateCommand({
    storeRoot: root,
    args: remainingArgs,
    stdin: process.stdin,
  });
  if (!updateResult.ok) {
    return formatError(
      toCliError("UPDATE_FAILED", updateResult.error.message, updateResult.error)
    );
  }
  return { exitCode: 0, output: updateResult.value.message };
};

export const runCli = async (options: CliRunOptions = {}): Promise<CliRunResult> => {
  const args = options.args ?? process.argv.slice(2);
  const cwd = options.cwd ?? process.cwd();
  const globalStoreFlag = parseGlobalStorePath(args);
  const remainingArgs = globalStoreFlag.remaining;
  if (globalStoreFlag.globalStorePath === "") {
    return formatError(
      toCliError("INVALID_COMMAND", "--global-store requires a value.")
    );
  }
  const globalStorePath =
    globalStoreFlag.globalStorePath ?? options.globalStorePath ?? ".config/cortex/.cortex";

  const [command, ...rest] = remainingArgs;
  if (!command) {
    return formatError(
      toCliError("INVALID_COMMAND", "No command provided.")
    );
  }
  const storeCommands = new Set(["reindex", "add", "update"]);
  if (storeCommands.has(command)) {
    return runCommandWithStore(rest, cwd, globalStorePath, command as "reindex" | "add" | "update");
  }

  return formatError(
    toCliError("INVALID_COMMAND", `Unknown command: ${command}.`)
  );
};
