/**
 * Update command flow for existing memories.
 */

import type { Result } from "../../core/types.ts";
import {
  parseMemoryFile,
  serializeMemoryFile,
  type MemoryFileContents,
} from "../../memory/file.ts";
import { validateMemorySlugPath } from "../../memory/validation.ts";
import type { StorageAdapterError } from "../../storage/adapter.ts";
import { FilesystemStorageAdapter } from "../../storage/filesystem.ts";
import {
  resolveMemoryContentInput,
  type MemoryContentInputError,
  type MemoryContentInputResult,
} from "../input.ts";

export interface UpdateCommandOptions {
  storeRoot: string;
  args: string[];
  stdin?: NodeJS.ReadableStream;
  now?: Date;
}

export interface UpdateCommandOutput {
  message: string;
}

export interface UpdateCommandError {
  code:
    | "INVALID_ARGS"
    | "CONTENT_INPUT_FAILED"
    | "INVALID_PATH"
    | "MEMORY_NOT_FOUND"
    | "READ_FAILED"
    | "PARSE_FAILED"
    | "SERIALIZE_FAILED"
    | "WRITE_FAILED";
  message: string;
  field?: string;
  cause?: StorageAdapterError | MemoryContentInputError | unknown;
}

interface ParsedUpdateArgs {
  slugPath: string;
  content?: string;
  filePath?: string;
  stdinRequested: boolean;
  tags?: string[];
  expiresAt?: Date;
  clearExpiry: boolean;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const parseTagsValue = (raw: string): Result<string[], UpdateCommandError> => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return ok([]);
  }
  const parts = trimmed.split(",");
  const tags = parts.map((part) => part.trim());
  if (tags.every((tag) => tag.length === 0)) {
    return ok([]);
  }
  for (const tag of tags) {
    if (!tag) {
      return err({
        code: "INVALID_ARGS",
        message: "Tags must be non-empty strings.",
        field: "tags",
      });
    }
  }
  return ok(tags);
};

const parseFlagValue = (
  args: string[],
  index: number,
  flag: string,
  field: UpdateCommandError["field"]
): Result<{ value: string; nextIndex: number }, UpdateCommandError> => {
  const candidate = args[index + 1];
  if (candidate === undefined) {
    return err({
      code: "INVALID_ARGS",
      message: `${flag} requires a value.`,
      field,
    });
  }
  return ok({ value: candidate, nextIndex: index + 1 });
};

const readUpdateFlag = (
  args: string[],
  index: number,
  flag: string,
  field: UpdateCommandError["field"]
): Result<{ value: string; nextIndex: number }, UpdateCommandError> =>
  parseFlagValue(args, index, flag, field);


const parseExpiresAtValue = (raw: string): Result<Date, UpdateCommandError> => {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return err({
      code: "INVALID_ARGS",
      message: "Expiry must be a valid ISO timestamp.",
      field: "expires_at",
    });
  }
  return ok(parsed);
};

const hasUpdatesRequested = (
  parsedArgs: ParsedUpdateArgs,
  contentInput: MemoryContentInputResult
): boolean => {
  const hasContentUpdate = contentInput.content !== null;
  const hasTagsUpdate = parsedArgs.tags !== undefined;
  const hasExpiryUpdate = parsedArgs.expiresAt !== undefined || parsedArgs.clearExpiry;
  return hasContentUpdate || hasTagsUpdate || hasExpiryUpdate;
};

type UpdateArgResult =
  | { kind: "skip" }
  | { kind: "next"; nextIndex: number }
  | { kind: "set"; nextIndex: number };

type FlagHandler = (state: ParsedUpdateArgs, value: string) => void;

const applyFlagValue = (
  state: ParsedUpdateArgs,
  args: string[],
  index: number,
  flag: string,
  field: UpdateCommandError["field"],
  handler: FlagHandler
): Result<UpdateArgResult, UpdateCommandError> => {
  const parsed = readUpdateFlag(args, index, flag, field);
  if (!parsed.ok) {
    return parsed;
  }
  handler(state, parsed.value.value);
  return ok({ kind: "set", nextIndex: parsed.value.nextIndex });
};

const handleTagsFlag = (
  state: ParsedUpdateArgs,
  raw: string
): Result<void, UpdateCommandError> => {
  const parsedTags = parseTagsValue(raw);
  if (!parsedTags.ok) {
    return parsedTags;
  }
  state.tags = parsedTags.value;
  return ok(undefined);
};

const handleExpiresFlag = (
  state: ParsedUpdateArgs,
  raw: string
): Result<void, UpdateCommandError> => {
  const parsedExpires = parseExpiresAtValue(raw);
  if (!parsedExpires.ok) {
    return parsedExpires;
  }
  state.expiresAt = parsedExpires.value;
  return ok(undefined);
};

type FlagHandlerFn = (
  state: ParsedUpdateArgs,
  args: string[],
  index: number
) => Result<UpdateArgResult, UpdateCommandError>;

const updateFlagHandlers: Record<string, FlagHandlerFn> = {
  "--content": (state, args, index) =>
    applyFlagValue(state, args, index, "--content", "content", (target, next) => {
      target.content = next;
    }),
  "--file": (state, args, index) =>
    applyFlagValue(state, args, index, "--file", "file", (target, next) => {
      target.filePath = next;
    }),
  "--stdin": (state) => {
    state.stdinRequested = true;
    return ok({ kind: "skip" });
  },
  "--tags": (state, args, index) => {
    const parsed = readUpdateFlag(args, index, "--tags", "tags");
    if (!parsed.ok) {
      return parsed;
    }
    const handled = handleTagsFlag(state, parsed.value.value);
    if (!handled.ok) {
      return handled;
    }
    return ok({ kind: "set", nextIndex: parsed.value.nextIndex });
  },
  "--expires-at": (state, args, index) => {
    const parsed = readUpdateFlag(args, index, "--expires-at", "expires_at");
    if (!parsed.ok) {
      return parsed;
    }
    const handled = handleExpiresFlag(state, parsed.value.value);
    if (!handled.ok) {
      return handled;
    }
    return ok({ kind: "set", nextIndex: parsed.value.nextIndex });
  },
  "--clear-expiry": (state) => {
    state.clearExpiry = true;
    return ok({ kind: "skip" });
  },
};

const applyUpdateArg = (
  state: ParsedUpdateArgs,
  args: string[],
  index: number,
  value: string
): Result<UpdateArgResult, UpdateCommandError> => {
  const handler = updateFlagHandlers[value];
  if (handler) {
    return handler(state, args, index);
  }
  if (value.startsWith("-")) {
    return err({
      code: "INVALID_ARGS",
      message: `Unknown option: ${value}.`,
    });
  }
  if (!state.slugPath) {
    state.slugPath = value;
    return ok({ kind: "skip" });
  }
  return err({
    code: "INVALID_ARGS",
    message: "Only one memory path may be provided.",
  });
};

const loadMemoryForUpdate = async (
  adapter: FilesystemStorageAdapter,
  slugPath: string
): Promise<Result<MemoryFileContents, UpdateCommandError>> => {
  const readResult = await adapter.readMemoryFile(slugPath);
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
      message: `Memory not found at ${slugPath}.`,
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
  return ok(parsedMemory.value);
};

const buildUpdatedMemory = (
  parsedMemory: MemoryFileContents,
  parsedArgs: ParsedUpdateArgs,
  contentInput: MemoryContentInputResult,
  now?: Date
): MemoryFileContents => ({
  frontmatter: {
    ...parsedMemory.frontmatter,
    updatedAt: now ?? new Date(),
    tags: parsedArgs.tags ?? parsedMemory.frontmatter.tags,
    expiresAt: parsedArgs.clearExpiry
      ? undefined
      : parsedArgs.expiresAt ?? parsedMemory.frontmatter.expiresAt,
  },
  content: contentInput.content ?? parsedMemory.content,
});

const persistUpdatedMemory = async (
  adapter: FilesystemStorageAdapter,
  slugPath: string,
  contents: MemoryFileContents
): Promise<Result<void, UpdateCommandError>> => {
  const serialized = serializeMemoryFile(contents);
  if (!serialized.ok) {
    return err({
      code: "SERIALIZE_FAILED",
      message: serialized.error.message,
      cause: serialized.error,
    });
  }
  const writeResult = await adapter.writeMemoryFile(slugPath, serialized.value);
  if (!writeResult.ok) {
    return err({
      code: "WRITE_FAILED",
      message: writeResult.error.message,
      cause: writeResult.error,
    });
  }
  return ok(undefined);
};

const parseUpdateArgs = (args: string[]): Result<ParsedUpdateArgs, UpdateCommandError> => {
  const state: ParsedUpdateArgs = {
    slugPath: "",
    clearExpiry: false,
    stdinRequested: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value) {
      continue;
    }
    const applied = applyUpdateArg(state, args, index, value);
    if (!applied.ok) {
      return applied;
    }
    if (applied.value.kind === "set") {
      index = applied.value.nextIndex;
    }
  }

  if (!state.slugPath) {
    return err({
      code: "INVALID_ARGS",
      message: "Memory path is required.",
    });
  }

  if (state.expiresAt && state.clearExpiry) {
    return err({
      code: "INVALID_ARGS",
      message: "Use either --expires-at or --clear-expiry, not both.",
      field: "expires_at",
    });
  }

  return ok(state);
};

export const runUpdateCommand = async (
  options: UpdateCommandOptions
): Promise<Result<UpdateCommandOutput, UpdateCommandError>> => {
  const parsedArgs = parseUpdateArgs(options.args);
  if (!parsedArgs.ok) {
    return parsedArgs;
  }

  const identity = validateMemorySlugPath(parsedArgs.value.slugPath);
  if (!identity.ok) {
    return err({
      code: "INVALID_PATH",
      message: identity.error.message,
      cause: identity.error,
    });
  }

  const contentInput = await resolveMemoryContentInput({
    content: parsedArgs.value.content,
    filePath: parsedArgs.value.filePath,
    stdin: options.stdin,
    stdinRequested: parsedArgs.value.stdinRequested,
    requireStdinFlag: true,
    requireContent: false,
  });
  if (!contentInput.ok) {
    return err({
      code: "CONTENT_INPUT_FAILED",
      message: contentInput.error.message,
      cause: contentInput.error,
    });
  }

  const hasUpdates = hasUpdatesRequested(parsedArgs.value, contentInput.value);

  if (!hasUpdates) {
    return err({
      code: "INVALID_ARGS",
      message: "No updates provided. Use --content, --file, --tags, or expiry flags.",
    });
  }

  const adapter = new FilesystemStorageAdapter({ rootDirectory: options.storeRoot });
  const parsedMemory = await loadMemoryForUpdate(adapter, identity.value.slugPath);
  if (!parsedMemory.ok) {
    return parsedMemory;
  }

  const nextMemory = buildUpdatedMemory(
    parsedMemory.value,
    parsedArgs.value,
    contentInput.value,
    options.now
  );
  const persisted = await persistUpdatedMemory(
    adapter,
    identity.value.slugPath,
    nextMemory
  );
  if (!persisted.ok) {
    return persisted;
  }

  return ok({
    message: `Updated memory at ${identity.value.slugPath}.`,
  });
};
