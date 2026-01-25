/**
 * CLI show command for reading and displaying memory content.
 */

import type { Result } from "../../core/types.ts";
import { defaultTokenizer } from "../../core/tokens.ts";
import { parseMemoryFile } from "../../memory/file.ts";
import { validateMemorySlugPath } from "../../memory/validation.ts";
import { FilesystemStorageAdapter } from "../../storage/filesystem.ts";
import type { OutputPayload, OutputMemory } from "../output.ts";

export interface ShowCommandOptions {
  storeRoot: string;
  args: string[];
}

export interface ShowCommandOutput {
  output: OutputPayload;
}

export interface ShowCommandError {
  code:
    | "INVALID_ARGUMENTS"
    | "INVALID_PATH"
    | "MEMORY_NOT_FOUND"
    | "READ_FAILED"
    | "PARSE_FAILED";
  message: string;
  cause?: unknown;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

interface ParsedShowArgs {
  slugPath: string;
}

const parseShowArgs = (args: string[]): Result<ParsedShowArgs, ShowCommandError> => {
  let slugPath = "";

  for (const arg of args) {
    if (!arg) {
      continue;
    }
    if (arg.startsWith("-")) {
      return err({
        code: "INVALID_ARGUMENTS",
        message: `Unknown flag: ${arg}.`,
      });
    }
    if (!slugPath) {
      slugPath = arg;
      continue;
    }
    return err({
      code: "INVALID_ARGUMENTS",
      message: "Too many positional arguments for show command.",
    });
  }

  if (!slugPath) {
    return err({
      code: "INVALID_ARGUMENTS",
      message: "Memory path is required for show command.",
    });
  }

  return ok({ slugPath });
};

export const runShowCommand = async (
  options: ShowCommandOptions
): Promise<Result<ShowCommandOutput, ShowCommandError>> => {
  const parsed = parseShowArgs(options.args);
  if (!parsed.ok) {
    return parsed;
  }

  const identity = validateMemorySlugPath(parsed.value.slugPath);
  if (!identity.ok) {
    return err({
      code: "INVALID_PATH",
      message: identity.error.message,
      cause: identity.error,
    });
  }

  const adapter = new FilesystemStorageAdapter({ rootDirectory: options.storeRoot });
  const readResult = await adapter.readMemoryFile(identity.value.slugPath);
  if (!readResult.ok) {
    return err({
      code: "READ_FAILED",
      message: readResult.error.message,
      cause: readResult.error,
    });
  }

  if (!readResult.value) {
    return err({
      code: "MEMORY_NOT_FOUND",
      message: `Memory not found at ${identity.value.slugPath}.`,
    });
  }

  const parsedMemory = parseMemoryFile(readResult.value);
  if (!parsedMemory.ok) {
    return err({
      code: "PARSE_FAILED",
      message: parsedMemory.error.message,
      cause: parsedMemory.error,
    });
  }

  const tokenEstimateResult = defaultTokenizer.estimateTokens(parsedMemory.value.content);
  const tokenEstimate = tokenEstimateResult.ok ? tokenEstimateResult.value : undefined;

  const outputMemory: OutputMemory = {
    path: identity.value.slugPath,
    metadata: {
      createdAt: parsedMemory.value.frontmatter.createdAt,
      updatedAt: parsedMemory.value.frontmatter.updatedAt,
      tags: parsedMemory.value.frontmatter.tags,
      source: parsedMemory.value.frontmatter.source,
      tokenEstimate,
      expiresAt: parsedMemory.value.frontmatter.expiresAt,
    },
    content: parsedMemory.value.content,
  };

  return ok({
    output: { kind: "memory", value: outputMemory },
  });
};
