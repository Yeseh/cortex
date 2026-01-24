/**
 * Memory file parsing and serialization helpers
 */

import type { Result } from "../core/types.ts";

export interface MemoryFileFrontmatter {
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  source: string;
  expiresAt?: Date;
}

export interface MemoryFileContents {
  frontmatter: MemoryFileFrontmatter;
  content: string;
}

export type MemoryFileParseErrorCode =
  | "MISSING_FRONTMATTER"
  | "INVALID_FRONTMATTER"
  | "MISSING_FIELD"
  | "INVALID_TIMESTAMP"
  | "INVALID_TAGS"
  | "INVALID_SOURCE";

export interface MemoryFileParseError {
  code: MemoryFileParseErrorCode;
  message: string;
  field?: string;
  line?: number;
}

export type MemoryFileSerializeErrorCode =
  | "INVALID_TIMESTAMP"
  | "INVALID_TAGS"
  | "INVALID_SOURCE";

export interface MemoryFileSerializeError {
  code: MemoryFileSerializeErrorCode;
  message: string;
  field?: string;
}

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

const parseTimestamp = (
  value: string,
  field: string,
  line: number
): Result<Date, MemoryFileParseError> => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return err({
      code: "INVALID_TIMESTAMP",
      message: `Invalid timestamp for ${field}.`,
      field,
      line,
    });
  }
  return ok(parsed);
};

const parseInlineTags = (
  value: string,
  line: number
): Result<string[], MemoryFileParseError> => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return err({
      code: "INVALID_TAGS",
      message: "Tags must be provided as a YAML list or inline array.",
      field: "tags",
      line,
    });
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return ok([]);
  }
  const entries = inner.split(",");
  const tags: string[] = [];
  for (const entry of entries) {
    const tag = entry.trim();
    if (!tag) {
      return err({
        code: "INVALID_TAGS",
        message: "Tags must be non-empty strings.",
        field: "tags",
        line,
      });
    }
    tags.push(tag);
  }

  return ok(tags);
};

const parseTagsList = (
  lines: string[],
  startIndex: number,
  lineOffset: number
): Result<{ tags: string[]; nextIndex: number }, MemoryFileParseError> => {
  const tags: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined) {
      break;
    }
    const match = /^\s*-\s*(.*)$/.exec(line);
    if (!match) {
      break;
    }
    const tagValue = match[1]?.trim() ?? "";
    if (!tagValue) {
      return err({
        code: "INVALID_TAGS",
        message: "Tags list entries must be non-empty.",
        field: "tags",
        line: index + lineOffset,
      });
    }
    tags.push(tagValue);
    index += 1;
  }

  return ok({ tags, nextIndex: index });
};

const parseFrontmatterLine = (
  rawLine: string,
  lineNumber: number
): Result<{ key: string; value: string }, MemoryFileParseError> => {
  const match = /^\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(rawLine);
  if (!match || !match[1]) {
    return err({
      code: "INVALID_FRONTMATTER",
      message: "Invalid frontmatter entry.",
      line: lineNumber,
    });
  }
  return ok({ key: match[1], value: match[2] ?? "" });
};

const validateFrontmatterKey = (
  key: string,
  seenKeys: Set<string>,
  lineNumber: number
): Result<void, MemoryFileParseError> => {
  if (seenKeys.has(key)) {
    return err({
      code: "INVALID_FRONTMATTER",
      message: "Duplicate frontmatter key.",
      line: lineNumber,
    });
  }
  return ok(undefined);
};

const parseFrontmatterValue = (
  key: string,
  value: string,
  lineNumber: number,
  frontmatterLines: string[],
  index: number
): Result<
  {
    nextIndex: number;
    createdAt?: Date;
    updatedAt?: Date;
    expiresAt?: Date;
    tags?: string[];
    source?: string;
  },
  MemoryFileParseError
> => parseFrontmatterValueByKey(key, value, lineNumber, frontmatterLines, index);

const parseTimestampField = (
  value: string,
  key: "created_at" | "updated_at" | "expires_at",
  lineNumber: number,
  index: number
): Result<
  {
    nextIndex: number;
    createdAt?: Date;
    updatedAt?: Date;
    expiresAt?: Date;
  },
  MemoryFileParseError
> => {
  const parsed = parseTimestamp(value.trim(), key, lineNumber);
  if (!parsed.ok) {
    return parsed;
  }
  if (key === "created_at") {
    return ok({ nextIndex: index + 1, createdAt: parsed.value });
  }
  if (key === "updated_at") {
    return ok({ nextIndex: index + 1, updatedAt: parsed.value });
  }
  return ok({ nextIndex: index + 1, expiresAt: parsed.value });
};

const parseTagsField = (
  value: string,
  lineNumber: number,
  frontmatterLines: string[],
  index: number
): Result<{ nextIndex: number; tags?: string[] }, MemoryFileParseError> => {
  if (!value.trim()) {
    const parsedList = parseTagsList(frontmatterLines, index + 1, 2);
    if (!parsedList.ok) {
      return parsedList;
    }
    return ok({ nextIndex: parsedList.value.nextIndex, tags: parsedList.value.tags });
  }
  const parsedInline = parseInlineTags(value, lineNumber);
  if (!parsedInline.ok) {
    return parsedInline;
  }
  return ok({ nextIndex: index + 1, tags: parsedInline.value });
};

const parseSourceField = (
  value: string,
  lineNumber: number,
  index: number
): Result<{ nextIndex: number; source?: string }, MemoryFileParseError> => {
  const trimmed = value.trim();
  if (!trimmed) {
    return err({
      code: "INVALID_SOURCE",
      message: "Source must be a non-empty string.",
      field: "source",
      line: lineNumber,
    });
  }
  return ok({ nextIndex: index + 1, source: trimmed });
};

const parseFrontmatterValueByKey = (
  key: string,
  value: string,
  lineNumber: number,
  frontmatterLines: string[],
  index: number
): Result<
  {
    nextIndex: number;
    createdAt?: Date;
    updatedAt?: Date;
    expiresAt?: Date;
    tags?: string[];
    source?: string;
  },
  MemoryFileParseError
> => {
  switch (key) {
    case "created_at":
      return parseTimestampField(value, "created_at", lineNumber, index);
    case "updated_at":
      return parseTimestampField(value, "updated_at", lineNumber, index);
    case "expires_at":
      return parseTimestampField(value, "expires_at", lineNumber, index);
    case "tags":
      return parseTagsField(value, lineNumber, frontmatterLines, index);
    case "source":
      return parseSourceField(value, lineNumber, index);
    default:
      return ok({ nextIndex: index + 1 });
  }
};

export const parseMemoryFile = (
  raw: string
): Result<MemoryFileContents, MemoryFileParseError> => {
  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const firstLine = lines[0];
  if (!firstLine || firstLine.trim() !== "---") {
    return err({
      code: "MISSING_FRONTMATTER",
      message: "Memory file must start with YAML frontmatter.",
      line: 1,
    });
  }

  let endIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) {
      break;
    }
    if (line.trim() === "---") {
      endIndex = index;
      break;
    }
  }

  if (endIndex === -1) {
    return err({
      code: "MISSING_FRONTMATTER",
      message: "Memory file frontmatter must be closed with '---'.",
      line: lines.length,
    });
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const content = lines.slice(endIndex + 1).join("\n");
  const parsedFrontmatter = parseFrontmatter(frontmatterLines);
  if (!parsedFrontmatter.ok) {
    return parsedFrontmatter;
  }

  return ok({
    frontmatter: parsedFrontmatter.value,
    content,
  });
};

const parseFrontmatter = (
  frontmatterLines: string[]
): Result<MemoryFileFrontmatter, MemoryFileParseError> => {
  const parsed = parseFrontmatterEntries(frontmatterLines);
  if (!parsed.ok) {
    return parsed;
  }
  const required = validateFrontmatterRequired(
    parsed.value.createdAt,
    parsed.value.updatedAt,
    parsed.value.tags,
    parsed.value.source
  );
  if (!required.ok) {
    return required;
  }

  return ok({
    createdAt: required.value.createdAt,
    updatedAt: required.value.updatedAt,
    tags: required.value.tags,
    source: required.value.source,
    expiresAt: parsed.value.expiresAt,
  });
};

const parseFrontmatterEntries = (
  frontmatterLines: string[]
): Result<
  {
    createdAt?: Date;
    updatedAt?: Date;
    expiresAt?: Date;
    tags?: string[];
    source?: string;
  },
  MemoryFileParseError
> => {
  return parseFrontmatterEntriesWithIndex(frontmatterLines, 0, new Set());
};

const parseFrontmatterEntriesWithIndex = (
  frontmatterLines: string[],
  startIndex: number,
  seenKeys: Set<string>
): Result<
  {
    createdAt?: Date;
    updatedAt?: Date;
    expiresAt?: Date;
    tags?: string[];
    source?: string;
  },
  MemoryFileParseError
> => {
  let createdAt: Date | undefined;
  let updatedAt: Date | undefined;
  let expiresAt: Date | undefined;
  let tags: string[] | undefined;
  let source: string | undefined;
  let index = startIndex;

  while (index < frontmatterLines.length) {
    const parsed = parseFrontmatterEntry(frontmatterLines, index, seenKeys);
    if (!parsed.ok) {
      return parsed;
    }
    if (!parsed.value) {
      index += 1;
      continue;
    }
    createdAt ??= parsed.value.createdAt;
    updatedAt ??= parsed.value.updatedAt;
    expiresAt ??= parsed.value.expiresAt;
    tags ??= parsed.value.tags;
    source ??= parsed.value.source;
    index = parsed.value.nextIndex;
  }

  return ok({ createdAt, updatedAt, expiresAt, tags, source });
};

const parseFrontmatterEntry = (
  frontmatterLines: string[],
  index: number,
  seenKeys: Set<string>
): Result<
  | {
      createdAt?: Date;
      updatedAt?: Date;
      expiresAt?: Date;
      tags?: string[];
      source?: string;
      nextIndex: number;
    }
  | null,
  MemoryFileParseError
> => {
  const rawLine = frontmatterLines[index];
  if (rawLine === undefined) {
    return ok(null);
  }
  const lineNumber = index + 2;
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) {
    return ok(null);
  }

  const parsedLine = parseFrontmatterLine(rawLine, lineNumber);
  if (!parsedLine.ok) {
    return parsedLine;
  }
  const key = parsedLine.value.key;
  const validated = validateFrontmatterKey(key, seenKeys, lineNumber);
  if (!validated.ok) {
    return validated;
  }
  seenKeys.add(key);

  const parsedValue = parseFrontmatterValue(
    key,
    parsedLine.value.value,
    lineNumber,
    frontmatterLines,
    index
  );
  if (!parsedValue.ok) {
    return parsedValue;
  }
  return ok(parsedValue.value);
};

const validateFrontmatterRequired = (
  createdAt: Date | undefined,
  updatedAt: Date | undefined,
  tags: string[] | undefined,
  source: string | undefined
): Result<
  { createdAt: Date; updatedAt: Date; tags: string[]; source: string },
  MemoryFileParseError
> => {
  if (!createdAt) {
    return err({
      code: "MISSING_FIELD",
      message: "Missing created_at field.",
      field: "created_at",
    });
  }
  if (!updatedAt) {
    return err({
      code: "MISSING_FIELD",
      message: "Missing updated_at field.",
      field: "updated_at",
    });
  }
  if (!tags) {
    return err({
      code: "MISSING_FIELD",
      message: "Missing tags field.",
      field: "tags",
    });
  }
  if (!source) {
    return err({
      code: "MISSING_FIELD",
      message: "Missing source field.",
      field: "source",
    });
  }

  return ok({ createdAt, updatedAt, tags, source });
};

const serializeTimestamp = (
  value: Date,
  field: string
): Result<string, MemoryFileSerializeError> => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return err({
      code: "INVALID_TIMESTAMP",
      message: `Invalid timestamp for ${field}.`,
      field,
    });
  }
  return ok(value.toISOString());
};

const normalizeTags = (
  tags: string[]
): Result<string[], MemoryFileSerializeError> => {
  if (!Array.isArray(tags)) {
    return err({
      code: "INVALID_TAGS",
      message: "Tags must be an array.",
      field: "tags",
    });
  }
  const normalized: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") {
      return err({
        code: "INVALID_TAGS",
        message: "Tags must be strings.",
        field: "tags",
      });
    }
    const trimmed = tag.trim();
    if (!trimmed) {
      return err({
        code: "INVALID_TAGS",
        message: "Tags must be non-empty strings.",
        field: "tags",
      });
    }
    normalized.push(trimmed);
  }
  return ok(normalized);
};

const validateSource = (
  source: string | undefined
): Result<string, MemoryFileSerializeError> => {
  const trimmed = source?.trim() ?? "";
  if (!trimmed) {
    return err({
      code: "INVALID_SOURCE",
      message: "Source must be a non-empty string.",
      field: "source",
    });
  }
  return ok(trimmed);
};

export const serializeMemoryFile = (
  memory: MemoryFileContents
): Result<string, MemoryFileSerializeError> => {
  const created = serializeTimestamp(memory.frontmatter.createdAt, "created_at");
  if (!created.ok) {
    return created;
  }
  const updated = serializeTimestamp(memory.frontmatter.updatedAt, "updated_at");
  if (!updated.ok) {
    return updated;
  }

  const normalizedTags = normalizeTags(memory.frontmatter.tags);
  if (!normalizedTags.ok) {
    return normalizedTags;
  }
  const source = validateSource(memory.frontmatter.source);
  if (!source.ok) {
    return source;
  }

  const lines: string[] = [
    `created_at: ${created.value}`,
    `updated_at: ${updated.value}`,
    `tags: [${normalizedTags.value.join(", ")}]`,
    `source: ${source.value}`,
  ];

  if (memory.frontmatter.expiresAt) {
    const expires = serializeTimestamp(memory.frontmatter.expiresAt, "expires_at");
    if (!expires.ok) {
      return expires;
    }
    lines.push(`expires_at: ${expires.value}`);
  }

  const frontmatter = `---\n${lines.join("\n")}\n---`;
  const content = memory.content ?? "";
  const separator = content.length > 0 && !content.startsWith("\n") ? "\n" : "";

  return ok(`${frontmatter}${separator}${content}`);
};
