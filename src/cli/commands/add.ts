/**
 * CLI add command parsing for memory content input.
 */

import type { Result } from "../../core/types.ts";
import type {
  MemoryContentInputError,
  MemoryContentSource,
} from "../input.ts";
import { resolveMemoryContentInput } from "../input.ts";

export interface AddCommandOptions {
  storeRoot?: string;
  args: string[];
  stdin?: NodeJS.ReadableStream;
}

export interface AddCommandOutput {
  path: string;
  content: string;
  source: MemoryContentSource;
}

export interface AddCommandError {
  code: "INVALID_ARGUMENTS" | "CONTENT_INPUT_FAILED";
  message: string;
  cause?: MemoryContentInputError;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const parseAddArgs = (
  args: string[]
): Result<{ path: string; content?: string; filePath?: string }, AddCommandError> => {
  let path: string | undefined;
  let content: string | undefined;
  let filePath: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value) {
      continue;
    }
    if (value === "--content") {
      const candidate = args[index + 1];
      if (!candidate) {
        return err({
          code: "INVALID_ARGUMENTS",
          message: "--content requires a value.",
        });
      }
      content = candidate;
      index += 1;
      continue;
    }
    if (value === "--file") {
      const candidate = args[index + 1];
      if (!candidate) {
        return err({
          code: "INVALID_ARGUMENTS",
          message: "--file requires a value.",
        });
      }
      filePath = candidate;
      index += 1;
      continue;
    }
    if (value.startsWith("--")) {
      return err({
        code: "INVALID_ARGUMENTS",
        message: `Unknown flag: ${value}.`,
      });
    }
    if (!path) {
      path = value;
      continue;
    }
    return err({
      code: "INVALID_ARGUMENTS",
      message: "Too many positional arguments for add command.",
    });
  }

  if (!path) {
    return err({
      code: "INVALID_ARGUMENTS",
      message: "Memory path is required for add command.",
    });
  }

  return ok({ path, content, filePath });
};

export const runAddCommand = async (
  options: AddCommandOptions
): Promise<Result<AddCommandOutput, AddCommandError>> => {
  const parsed = parseAddArgs(options.args);
  if (!parsed.ok) {
    return parsed;
  }

  const contentResult = await resolveMemoryContentInput({
    content: parsed.value.content,
    filePath: parsed.value.filePath,
    stdin: options.stdin,
    requireStdinFlag: false,
    requireContent: true,
  });
  if (!contentResult.ok) {
    return err({
      code: "CONTENT_INPUT_FAILED",
      message: contentResult.error.message,
      cause: contentResult.error,
    });
  }

  return ok({
    path: parsed.value.path,
    content: contentResult.value.content ?? "",
    source: contentResult.value.source,
  });
};
