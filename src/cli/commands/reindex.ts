/**
 * Reindex command flow for rebuilding category indexes.
 */

import type { Result } from "../../core/types.ts";
import type { StorageAdapterError } from "../../storage/adapter.ts";
import { FilesystemStorageAdapter } from "../../storage/filesystem.ts";

export interface ReindexCommandOptions {
  storeRoot: string;
  args: string[];
}

export interface ReindexCommandOutput {
  message: string;
}

export interface ReindexCommandError {
  code: "REINDEX_FAILED" | "INVALID_ARGUMENTS";
  message: string;
  cause?: StorageAdapterError;
  details?: { args: string[] };
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const runReindexCommand = async (
  options: ReindexCommandOptions
): Promise<Result<ReindexCommandOutput, ReindexCommandError>> => {
  if (options.args.length > 0) {
    return err({
      code: "INVALID_ARGUMENTS",
      message: `Unexpected arguments for reindex: ${options.args.join(" ")}.`,
      details: { args: options.args },
    });
  }
  const adapter = new FilesystemStorageAdapter({ rootDirectory: options.storeRoot });
  const reindexResult = await adapter.reindexCategoryIndexes();
  if (!reindexResult.ok) {
    return err({
      code: "REINDEX_FAILED",
      message: reindexResult.error.message,
      cause: reindexResult.error,
    });
  }

  return ok({
    message: `Reindexed category indexes for ${options.storeRoot}.`,
  });
};
