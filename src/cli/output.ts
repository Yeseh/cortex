/**
 * Output format types and serialization helpers.
 */

import type { Result } from "../core/types.ts";

export type OutputFormat = "yaml" | "json";

export interface OutputMemoryMetadata {
  createdAt: Date;
  updatedAt?: Date;
  tags: string[];
  source?: string;
  tokenEstimate?: number;
  expiresAt?: Date;
}

export interface OutputMemory {
  path: string;
  metadata: OutputMemoryMetadata;
  content: string;
}

export interface OutputCategoryMemory {
  path: string;
  tokenEstimate?: number;
  summary?: string;
}

export interface OutputSubcategory {
  path: string;
  memoryCount: number;
}

export interface OutputCategory {
  path: string;
  memories: OutputCategoryMemory[];
  subcategories: OutputSubcategory[];
}

export interface OutputStore {
  name: string;
  path: string;
}

export interface OutputStoreRegistry {
  stores: OutputStore[];
}

export interface OutputStoreInit {
  path: string;
}

export type OutputPayload =
  | { kind: "memory"; value: OutputMemory }
  | { kind: "category"; value: OutputCategory }
  | { kind: "store"; value: OutputStore }
  | { kind: "store-registry"; value: OutputStoreRegistry }
  | { kind: "store-init"; value: OutputStoreInit };

export interface OutputSerializeError {
  code: "INVALID_FORMAT" | "INVALID_FIELD";
  message: string;
  field?: string;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const formatYamlScalar = (value: string): string => JSON.stringify(value);

const validateNonNegativeNumber = (
  value: number,
  field: string
): Result<number, OutputSerializeError> => {
  if (!Number.isFinite(value) || value < 0) {
    return err({
      code: "INVALID_FIELD",
      message: `${field} must be a non-negative finite number.`,
      field,
    });
  }
  return ok(value);
};

const validateRequiredPath = (
  value: string,
  field: string,
  label: string
): Result<string, OutputSerializeError> => {
  const trimmedValue = typeof value === "string" ? value.trim() : "";
  if (!trimmedValue) {
    return err({
      code: "INVALID_FIELD",
      message: `${label} path is required.`,
      field,
    });
  }
  return ok(trimmedValue);
};

const validateStoreName = (
  value: string,
  field: string
): Result<string, OutputSerializeError> => {
  const trimmedValue = typeof value === "string" ? value.trim() : "";
  if (!trimmedValue) {
    return err({
      code: "INVALID_FIELD",
      message: "Store name is required.",
      field,
    });
  }
  const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!pattern.test(trimmedValue)) {
    return err({
      code: "INVALID_FIELD",
      message: "Store name must be a lowercase slug.",
      field,
    });
  }
  return ok(trimmedValue);
};

const serializeTimestamp = (
  value: Date,
  field: string
): Result<string, OutputSerializeError> => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return err({
      code: "INVALID_FIELD",
      message: `Invalid timestamp for ${field}.`,
      field,
    });
  }
  return ok(value.toISOString());
};

const serializeTags = (
  tags: string[]
): Result<string[], OutputSerializeError> => {
  if (!Array.isArray(tags)) {
    return err({
      code: "INVALID_FIELD",
      message: "Tags must be an array.",
      field: "tags",
    });
  }
  for (const tag of tags) {
    if (typeof tag !== "string" || !tag.trim()) {
      return err({
        code: "INVALID_FIELD",
        message: "Tags must be non-empty strings.",
        field: "tags",
      });
    }
  }
  return ok(tags.map((tag) => tag.trim()));
};

const serializeOptionalTimestamp = (
  value: Date | undefined,
  field: string
): Result<string | undefined, OutputSerializeError> => {
  if (!value) {
    return ok(undefined);
  }
  return serializeTimestamp(value, field);
};

const serializeOptionalNumber = (
  value: number | undefined,
  field: string
): Result<number | undefined, OutputSerializeError> => {
  if (value === undefined) {
    return ok(undefined);
  }
  return validateNonNegativeNumber(value, field);
};

const appendYamlTags = (lines: string[], tags: string[]): void => {
  if (tags.length === 0) {
    lines.push("tags: []");
    return;
  }
  lines.push("tags:");
  for (const tag of tags) {
    lines.push(`  - ${formatYamlScalar(tag)}`);
  }
};

const addOptionalYamlLine = (lines: string[], key: string, value?: string): void => {
  if (!value) {
    return;
  }
  lines.push(`${key}: ${formatYamlScalar(value)}`);
};

const writeOptionalYamlTimestamp = (
  lines: string[],
  key: string,
  value: Date | undefined
): Result<void, OutputSerializeError> => {
  const parsed = serializeOptionalTimestamp(value, key);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value) {
    lines.push(`${key}: ${parsed.value}`);
  }
  return ok(undefined);
};

const writeOptionalYamlNumber = (
  lines: string[],
  key: string,
  value: number | undefined
): Result<void, OutputSerializeError> => {
  const parsed = serializeOptionalNumber(value, key);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value !== undefined) {
    lines.push(`${key}: ${parsed.value}`);
  }
  return ok(undefined);
};

const appendCategoryMemories = (
  lines: string[],
  entries: OutputCategoryMemory[]
): Result<void, OutputSerializeError> => {
  if (entries.length === 0) {
    lines.push("memories: []");
    return ok(undefined);
  }
  lines.push("memories:");
  for (const entry of entries) {
    const entryPath = validateRequiredPath(entry.path, "memories.path", "Category memory");
    if (!entryPath.ok) {
      return entryPath;
    }
    lines.push(`  - path: ${formatYamlScalar(entryPath.value)}`);
    const tokenEstimate = serializeOptionalNumber(
      entry.tokenEstimate,
      "memories.token_estimate"
    );
    if (!tokenEstimate.ok) {
      return tokenEstimate;
    }
    if (tokenEstimate.value !== undefined) {
      lines.push(`    token_estimate: ${tokenEstimate.value}`);
    }
    const summary = entry.summary?.trim();
    if (summary) {
      lines.push(`    summary: ${formatYamlScalar(summary)}`);
    }
  }
  return ok(undefined);
};

const appendCategorySubcategories = (
  lines: string[],
  entries: OutputSubcategory[]
): Result<void, OutputSerializeError> => {
  if (entries.length === 0) {
    lines.push("subcategories: []");
    return ok(undefined);
  }
  lines.push("subcategories:");
  for (const entry of entries) {
    const entryPath = validateRequiredPath(
      entry.path,
      "subcategories.path",
      "Category subcategory"
    );
    if (!entryPath.ok) {
      return entryPath;
    }
    const memoryCount = validateNonNegativeNumber(
      entry.memoryCount,
      "subcategories.memory_count"
    );
    if (!memoryCount.ok) {
      return memoryCount;
    }
    lines.push(`  - path: ${formatYamlScalar(entryPath.value)}`);
    lines.push(`    memory_count: ${memoryCount.value}`);
  }
  return ok(undefined);
};

const serializeCategoryMemoriesJson = (
  entries: OutputCategoryMemory[]
): Result<Array<Record<string, unknown>>, OutputSerializeError> => {
  const memories: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    const entryPath = validateRequiredPath(entry.path, "memories.path", "Category memory");
    if (!entryPath.ok) {
      return entryPath;
    }
    const record: Record<string, unknown> = { path: entryPath.value };
    const tokenEstimate = serializeOptionalNumber(
      entry.tokenEstimate,
      "memories.token_estimate"
    );
    if (!tokenEstimate.ok) {
      return tokenEstimate;
    }
    if (tokenEstimate.value !== undefined) {
      record.token_estimate = tokenEstimate.value;
    }
    const summary = entry.summary?.trim();
    if (summary) {
      record.summary = summary;
    }
    memories.push(record);
  }
  return ok(memories);
};

const serializeCategorySubcategoriesJson = (
  entries: OutputSubcategory[]
): Result<Array<Record<string, unknown>>, OutputSerializeError> => {
  const subcategories: Array<Record<string, unknown>> = [];
  for (const entry of entries) {
    const entryResult = buildSubcategoryJsonEntry(entry);
    if (!entryResult.ok) {
      return entryResult;
    }
    subcategories.push(entryResult.value);
  }
  return ok(subcategories);
};

const buildSubcategoryJsonEntry = (
  entry: OutputSubcategory
): Result<Record<string, unknown>, OutputSerializeError> => {
  const entryPath = validateRequiredPath(
    entry.path,
    "subcategories.path",
    "Category subcategory"
  );
  if (!entryPath.ok) {
    return entryPath;
  }
  const memoryCount = validateNonNegativeNumber(
    entry.memoryCount,
    "subcategories.memory_count"
  );
  if (!memoryCount.ok) {
    return memoryCount;
  }
  return ok({ path: entryPath.value, memory_count: memoryCount.value });
};

const buildMemoryYamlLines = (
  memoryPath: string,
  created: string,
  metadata: OutputMemoryMetadata
): Result<string[], OutputSerializeError> => {
  const tags = serializeTags(metadata.tags);
  if (!tags.ok) {
    return tags;
  }

  const lines: string[] = [`# ${memoryPath}`, `created_at: ${created}`];
  const updated = writeOptionalYamlTimestamp(lines, "updated_at", metadata.updatedAt);
  if (!updated.ok) {
    return updated;
  }

  appendYamlTags(lines, tags.value);
  addOptionalYamlLine(lines, "source", metadata.source?.trim());

  const tokenEstimate = writeOptionalYamlNumber(
    lines,
    "token_estimate",
    metadata.tokenEstimate
  );
  if (!tokenEstimate.ok) {
    return tokenEstimate;
  }

  const expires = writeOptionalYamlTimestamp(lines, "expires_at", metadata.expiresAt);
  if (!expires.ok) {
    return expires;
  }

  lines.push("---");
  return ok(lines);
};

const serializeMemoryYaml = (
  memory: OutputMemory
): Result<string, OutputSerializeError> => {
  const memoryPath = validateRequiredPath(memory.path, "path", "Memory");
  if (!memoryPath.ok) {
    return memoryPath;
  }

  const created = serializeTimestamp(memory.metadata.createdAt, "created_at");
  if (!created.ok) {
    return created;
  }

  const lines = buildMemoryYamlLines(
    memoryPath.value,
    created.value,
    memory.metadata
  );
  if (!lines.ok) {
    return lines;
  }

  const content = memory.content ?? "";
  const separator =
    content.length === 0 ? "\n" : content.startsWith("\n") ? "" : "\n";

  return ok(`${lines.value.join("\n")}${separator}${content}`);
};

const serializeCategoryYaml = (
  category: OutputCategory
): Result<string, OutputSerializeError> => {
  const categoryPath = validateRequiredPath(category.path, "path", "Category");
  if (!categoryPath.ok) {
    return categoryPath;
  }

  const lines: string[] = [`# ${categoryPath.value}`];

  const memoriesResult = appendCategoryMemories(lines, category.memories);
  if (!memoriesResult.ok) {
    return memoriesResult;
  }

  const subcategoriesResult = appendCategorySubcategories(
    lines,
    category.subcategories
  );
  if (!subcategoriesResult.ok) {
    return subcategoriesResult;
  }

  return ok(lines.join("\n"));
};

const buildMemoryJsonMetadata = (
  memory: OutputMemory
): Result<Record<string, unknown>, OutputSerializeError> => {
  const base = buildMemoryJsonBase(memory);
  if (!base.ok) {
    return base;
  }

  const metadata = base.value;
  const updated = serializeOptionalTimestamp(memory.metadata.updatedAt, "updated_at");
  if (!updated.ok) {
    return updated;
  }
  if (updated.value) {
    metadata.updated_at = updated.value;
  }

  const source = memory.metadata.source?.trim();
  if (source) {
    metadata.source = source;
  }

  const tokenEstimate = serializeOptionalNumber(
    memory.metadata.tokenEstimate,
    "token_estimate"
  );
  if (!tokenEstimate.ok) {
    return tokenEstimate;
  }
  if (tokenEstimate.value !== undefined) {
    metadata.token_estimate = tokenEstimate.value;
  }

  const expires = serializeOptionalTimestamp(memory.metadata.expiresAt, "expires_at");
  if (!expires.ok) {
    return expires;
  }
  if (expires.value) {
    metadata.expires_at = expires.value;
  }

  return ok(metadata);
};

const buildMemoryJsonBase = (
  memory: OutputMemory
): Result<Record<string, unknown>, OutputSerializeError> => {
  const created = serializeTimestamp(memory.metadata.createdAt, "created_at");
  if (!created.ok) {
    return created;
  }
  const tags = serializeTags(memory.metadata.tags);
  if (!tags.ok) {
    return tags;
  }

  return ok({
    created_at: created.value,
    tags: tags.value,
  });
};

const serializeMemoryJson = (
  memory: OutputMemory
): Result<string, OutputSerializeError> => {
  const memoryPath = validateRequiredPath(memory.path, "path", "Memory");
  if (!memoryPath.ok) {
    return memoryPath;
  }
  const metadata = buildMemoryJsonMetadata(memory);
  if (!metadata.ok) {
    return metadata;
  }

  return ok(
    JSON.stringify({
      path: memoryPath.value,
      metadata: metadata.value,
      content: memory.content ?? "",
    })
  );
};

const serializeCategoryJson = (
  category: OutputCategory
): Result<string, OutputSerializeError> => {
  const categoryPath = validateRequiredPath(category.path, "path", "Category");
  if (!categoryPath.ok) {
    return categoryPath;
  }

  const memoriesResult = serializeCategoryMemoriesJson(category.memories);
  if (!memoriesResult.ok) {
    return memoriesResult;
  }

  const subcategoriesResult = serializeCategorySubcategoriesJson(
    category.subcategories
  );
  if (!subcategoriesResult.ok) {
    return subcategoriesResult;
  }

  return ok(
    JSON.stringify({
      path: categoryPath.value,
      memories: memoriesResult.value,
      subcategories: subcategoriesResult.value,
    })
  );
};

const serializeStoreYaml = (
  store: OutputStore
): Result<string, OutputSerializeError> => {
  const name = validateStoreName(store.name, "store.name");
  if (!name.ok) {
    return name;
  }
  const path = validateRequiredPath(store.path, "store.path", "Store");
  if (!path.ok) {
    return path;
  }

  return ok(
    [
      "store:",
      `  name: ${formatYamlScalar(name.value)}`,
      `  path: ${formatYamlScalar(path.value)}`,
    ].join("\n")
  );
};

const serializeStoreJson = (
  store: OutputStore
): Result<string, OutputSerializeError> => {
  const name = validateStoreName(store.name, "store.name");
  if (!name.ok) {
    return name;
  }
  const path = validateRequiredPath(store.path, "store.path", "Store");
  if (!path.ok) {
    return path;
  }

  return ok(
    JSON.stringify({
      store: {
        name: name.value,
        path: path.value,
      },
    })
  );
};

const serializeStoreRegistryYaml = (
  registry: OutputStoreRegistry
): Result<string, OutputSerializeError> => {
  if (!Array.isArray(registry.stores)) {
    return err({
      code: "INVALID_FIELD",
      message: "Stores must be an array.",
      field: "stores",
    });
  }

  if (registry.stores.length === 0) {
    return ok("stores: []");
  }

  const lines: string[] = ["stores:"];
  for (const entry of registry.stores) {
    const name = validateStoreName(entry.name, "stores.name");
    if (!name.ok) {
      return name;
    }
    const path = validateRequiredPath(entry.path, "stores.path", "Store");
    if (!path.ok) {
      return path;
    }
    lines.push(`  - name: ${formatYamlScalar(name.value)}`);
    lines.push(`    path: ${formatYamlScalar(path.value)}`);
  }

  return ok(lines.join("\n"));
};

const serializeStoreRegistryJson = (
  registry: OutputStoreRegistry
): Result<string, OutputSerializeError> => {
  if (!Array.isArray(registry.stores)) {
    return err({
      code: "INVALID_FIELD",
      message: "Stores must be an array.",
      field: "stores",
    });
  }

  const stores: Array<{ name: string; path: string }> = [];
  for (const entry of registry.stores) {
    const name = validateStoreName(entry.name, "stores.name");
    if (!name.ok) {
      return name;
    }
    const path = validateRequiredPath(entry.path, "stores.path", "Store");
    if (!path.ok) {
      return path;
    }
    stores.push({ name: name.value, path: path.value });
  }

  return ok(JSON.stringify({ stores }));
};

const serializeStoreInitYaml = (
  storeInit: OutputStoreInit
): Result<string, OutputSerializeError> => {
  const path = validateRequiredPath(storeInit.path, "path", "Store");
  if (!path.ok) {
    return path;
  }
  return ok(`path: ${formatYamlScalar(path.value)}`);
};

const serializeStoreInitJson = (
  storeInit: OutputStoreInit
): Result<string, OutputSerializeError> => {
  const path = validateRequiredPath(storeInit.path, "path", "Store");
  if (!path.ok) {
    return path;
  }
  return ok(JSON.stringify({ path: path.value }));
};

const serializeYamlOutput = (payload: OutputPayload): Result<string, OutputSerializeError> => {
  switch (payload.kind) {
    case "memory":
      return serializeMemoryYaml(payload.value);
    case "category":
      return serializeCategoryYaml(payload.value);
    case "store":
      return serializeStoreYaml(payload.value);
    case "store-registry":
      return serializeStoreRegistryYaml(payload.value);
    case "store-init":
      return serializeStoreInitYaml(payload.value);
  }
};

const serializeJsonOutput = (payload: OutputPayload): Result<string, OutputSerializeError> => {
  switch (payload.kind) {
    case "memory":
      return serializeMemoryJson(payload.value);
    case "category":
      return serializeCategoryJson(payload.value);
    case "store":
      return serializeStoreJson(payload.value);
    case "store-registry":
      return serializeStoreRegistryJson(payload.value);
    case "store-init":
      return serializeStoreInitJson(payload.value);
  }
};

export const serializeOutput = (
  payload: OutputPayload,
  format: OutputFormat
): Result<string, OutputSerializeError> => {
  if (format === "yaml") {
    return serializeYamlOutput(payload);
  }

  if (format === "json") {
    return serializeJsonOutput(payload);
  }

  return err({
    code: "INVALID_FORMAT",
    message: `Unsupported output format: ${format}`,
    field: "output_format",
  });
};
