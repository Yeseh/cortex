import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { parseCategoryIndex } from "../src/index/parser.ts";
import { runStoreCommand } from "../src/cli/commands/store.ts";
import { parseStoreRegistry, saveStoreRegistry } from "../src/store/registry.ts";

const normalizePath = (value: string): string => value.replace(/\\/g, "/");

describe("store CLI commands", () => {
  let tempDir: string;

  const buildOptions = (args: string[]) => ({
    args,
    cwd: tempDir,
    registryPath: join(tempDir, "store-registry.yaml"),
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cortex-store-cli-"));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should list an empty registry when missing", async () => {
    const result = await runStoreCommand(buildOptions(["list"]));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.output).toEqual({
      kind: "store-registry",
      value: { stores: [] },
    });
  });

  it("should list registry entries sorted by name", async () => {
    const registryPath = join(tempDir, "store-registry.yaml");
    const rawRegistry = [
      "stores:",
      "  zeta:",
      "    path: C:/Stores/Zeta",
      "  alpha:",
      "    path: C:/Stores/Alpha",
    ].join("\n");
    await writeFile(registryPath, rawRegistry, "utf8");

    const result = await runStoreCommand(buildOptions(["list"]));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.output).toEqual({
      kind: "store-registry",
      value: {
        stores: [
          { name: "alpha", path: "C:/Stores/Alpha" },
          { name: "zeta", path: "C:/Stores/Zeta" },
        ],
      },
    });
  });

  it("should add a store and persist the registry", async () => {
    const result = await runStoreCommand(
      buildOptions(["add", "primary", "C:/Stores/Primary"])
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.output).toEqual({
      kind: "store",
      value: { name: "primary", path: "C:/Stores/Primary" },
    });

    const registryContents = await readFile(buildOptions([]).registryPath, "utf8");
    const parsed = parseStoreRegistry(registryContents);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({
        primary: { path: "C:/Stores/Primary" },
      });
    }
  });

  it("should reject duplicate store registration", async () => {
    const saved = await saveStoreRegistry(buildOptions([]).registryPath, {
      primary: { path: "C:/Stores/Primary" },
    });
    expect(saved.ok).toBe(true);

    const result = await runStoreCommand(
      buildOptions(["add", "primary", "C:/Stores/Secondary"])
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STORE_ALREADY_EXISTS");
    }
  });

  it("should remove a store and keep remaining entries", async () => {
    const saved = await saveStoreRegistry(buildOptions([]).registryPath, {
      primary: { path: "C:/Stores/Primary" },
      secondary: { path: "C:/Stores/Secondary" },
    });
    expect(saved.ok).toBe(true);

    const result = await runStoreCommand(buildOptions(["remove", "primary"]));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.output).toEqual({
      kind: "store",
      value: { name: "primary", path: "C:/Stores/Primary" },
    });

    const registryContents = await readFile(buildOptions([]).registryPath, "utf8");
    const parsed = parseStoreRegistry(registryContents);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual({
        secondary: { path: "C:/Stores/Secondary" },
      });
    }
  });

  it("should delete the registry when removing the last store", async () => {
    const saved = await saveStoreRegistry(buildOptions([]).registryPath, {
      primary: { path: "C:/Stores/Primary" },
    });
    expect(saved.ok).toBe(true);

    const result = await runStoreCommand(buildOptions(["remove", "primary"]));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    await expect(access(buildOptions([]).registryPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("should initialize a store in the default path", async () => {
    const result = await runStoreCommand(buildOptions(["init"]));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const expectedRoot = resolve(tempDir, ".cortex");
    const output = result.value.output;
    expect(output.kind).toBe("store-init");
    if (output.kind === "store-init") {
      expect(normalizePath(output.value.path)).toBe(normalizePath(expectedRoot));
    }

    const indexPath = join(expectedRoot, "index.yaml");
    const indexContents = await readFile(indexPath, "utf8");
    const parsedIndex = parseCategoryIndex(indexContents);
    expect(parsedIndex.ok).toBe(true);
    if (parsedIndex.ok) {
      expect(parsedIndex.value).toEqual({ memories: [], subcategories: [] });
    }
  });

  it("should initialize a store at the provided path", async () => {
    const result = await runStoreCommand(buildOptions(["init", "custom-store"]));

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const expectedRoot = resolve(tempDir, "custom-store");
    const output = result.value.output;
    expect(output.kind).toBe("store-init");
    if (output.kind === "store-init") {
      expect(normalizePath(output.value.path)).toBe(normalizePath(expectedRoot));
    }

    const configPath = join(expectedRoot, "config.yaml");
    const indexPath = join(expectedRoot, "index.yaml");
    await expect(access(configPath)).resolves.toBeNull();
    const indexContents = await readFile(indexPath, "utf8");
    const parsedIndex = parseCategoryIndex(indexContents);
    expect(parsedIndex.ok).toBe(true);
  });

  it("should reject missing commands and arguments", async () => {
    const missingCommand = await runStoreCommand(buildOptions([]));
    expect(missingCommand.ok).toBe(false);
    if (!missingCommand.ok) {
      expect(missingCommand.error.code).toBe("INVALID_COMMAND");
    }

    const missingAddArgs = await runStoreCommand(buildOptions(["add", "primary"]));
    expect(missingAddArgs.ok).toBe(false);
    if (!missingAddArgs.ok) {
      expect(missingAddArgs.error.code).toBe("INVALID_COMMAND");
    }

    const missingRemoveArgs = await runStoreCommand(buildOptions(["remove"]));
    expect(missingRemoveArgs.ok).toBe(false);
    if (!missingRemoveArgs.ok) {
      expect(missingRemoveArgs.error.code).toBe("INVALID_COMMAND");
    }
  });

  it("should reject invalid store inputs", async () => {
    const invalidName = await runStoreCommand(
      buildOptions(["add", "Bad Name", "C:/Stores/Primary"])
    );
    expect(invalidName.ok).toBe(false);
    if (!invalidName.ok) {
      expect(invalidName.error.code).toBe("INVALID_STORE_NAME");
    }

    const invalidPath = await runStoreCommand(
      buildOptions(["add", "primary", "   "])
    );
    expect(invalidPath.ok).toBe(false);
    if (!invalidPath.ok) {
      expect(invalidPath.error.code).toBe("INVALID_STORE_PATH");
    }
  });
});
