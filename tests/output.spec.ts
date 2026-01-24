import { describe, expect, it } from "bun:test";

import { serializeOutput } from "../src/cli/output.ts";

const baseMemory = () => ({
  path: "working/preferences",
  metadata: {
    createdAt: new Date("2024-06-01T10:00:00.000Z"),
    updatedAt: new Date("2024-06-02T12:30:00.000Z"),
    tags: ["alpha", "needs:quote", "hash#tag"],
    source: "  system  ",
    tokenEstimate: 12,
    expiresAt: new Date("2024-07-01T00:00:00.000Z"),
  },
  content: "Remember the preferences.\nSecond line.",
});

describe("output serialization", () => {
  describe("single memory output", () => {
    it("should serialize a memory to JSON with metadata fields", () => {
      const result = serializeOutput({ kind: "memory", value: baseMemory() }, "json");

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      const payload = JSON.parse(result.value) as {
        path: string;
        metadata: Record<string, unknown>;
        content: string;
      };

      expect(payload.path).toBe("working/preferences");
      expect(payload.content).toBe("Remember the preferences.\nSecond line.");
      expect(payload.metadata).toEqual({
        created_at: "2024-06-01T10:00:00.000Z",
        updated_at: "2024-06-02T12:30:00.000Z",
        tags: ["alpha", "needs:quote", "hash#tag"],
        source: "system",
        token_estimate: 12,
        expires_at: "2024-07-01T00:00:00.000Z",
      });
    });

    it("should serialize a memory to YAML with quoted tags and content separator", () => {
      const result = serializeOutput({ kind: "memory", value: baseMemory() }, "yaml");

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value).toContain("# working/preferences");
      expect(result.value).toContain("created_at: 2024-06-01T10:00:00.000Z");
      expect(result.value).toContain("updated_at: 2024-06-02T12:30:00.000Z");
      expect(result.value).toContain("token_estimate: 12");
      expect(result.value).toContain("expires_at: 2024-07-01T00:00:00.000Z");
      expect(result.value).toContain("source: \"system\"");
      expect(result.value).toContain("tags:\n  - \"alpha\"");
      expect(result.value).toContain("  - \"needs:quote\"");
      expect(result.value).toContain("  - \"hash#tag\"");
      expect(result.value).toContain("---\nRemember the preferences.\nSecond line.");
    });

    it("should omit empty source values", () => {
      const memory = baseMemory();
      memory.metadata.source = "   ";

      const jsonResult = serializeOutput({ kind: "memory", value: memory }, "json");
      expect(jsonResult.ok).toBe(true);
      if (jsonResult.ok) {
        const payload = JSON.parse(jsonResult.value) as {
          metadata: Record<string, unknown>;
        };
        expect(payload.metadata).not.toHaveProperty("source");
      }

      const yamlResult = serializeOutput({ kind: "memory", value: memory }, "yaml");
      expect(yamlResult.ok).toBe(true);
      if (yamlResult.ok) {
        expect(yamlResult.value).not.toContain("source:");
      }
    });
  });

  describe("category output", () => {
    const categoryPayload = {
      path: "working",
      memories: [
        { path: "working/alpha", tokenEstimate: 4, summary: "  Quick note " },
        { path: "working/empty", tokenEstimate: 0, summary: "   " },
      ],
      subcategories: [{ path: "working/sub", memoryCount: 2 }],
    };

    it("should serialize categories to JSON with trimmed summaries", () => {
      const result = serializeOutput(
        { kind: "category", value: categoryPayload },
        "json"
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      const payload = JSON.parse(result.value) as {
        path: string;
        memories: Array<Record<string, unknown>>;
        subcategories: Array<Record<string, unknown>>;
      };

      expect(payload.path).toBe("working");
      expect(payload.memories).toEqual([
        { path: "working/alpha", token_estimate: 4, summary: "Quick note" },
        { path: "working/empty", token_estimate: 0 },
      ]);
      expect(payload.subcategories).toEqual([
        { path: "working/sub", memory_count: 2 },
      ]);
    });

    it("should serialize categories to YAML with trimmed summaries", () => {
      const result = serializeOutput(
        { kind: "category", value: categoryPayload },
        "yaml"
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }

      expect(result.value).toContain("# working");
      expect(result.value).toContain("memories:");
      expect(result.value).toContain("- path: \"working/alpha\"");
      expect(result.value).toContain("token_estimate: 4");
      expect(result.value).toContain("summary: \"Quick note\"");
      expect(result.value).toContain("- path: \"working/empty\"");
      expect(result.value).toContain("token_estimate: 0");
      expect(result.value).not.toContain("summary: \"\"");
      expect(result.value).toContain("subcategories:");
      expect(result.value).toContain("- path: \"working/sub\"");
      expect(result.value).toContain("memory_count: 2");
    });
  });

  describe("validation errors", () => {
    it("should reject unsupported formats", () => {
      const result = serializeOutput(
        { kind: "memory", value: baseMemory() },
        "xml" as "json"
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_FORMAT");
        expect(result.error.field).toBe("output_format");
      }
    });

    it("should reject empty paths", () => {
      const memory = baseMemory();
      memory.path = "   ";

      const result = serializeOutput({ kind: "memory", value: memory }, "json");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_FIELD");
        expect(result.error.field).toBe("path");
      }
    });

    it("should reject invalid timestamps", () => {
      const memory = baseMemory();
      memory.metadata.createdAt = new Date("invalid");

      const result = serializeOutput({ kind: "memory", value: memory }, "json");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_FIELD");
        expect(result.error.field).toBe("created_at");
      }
    });

    it("should reject empty or invalid tags", () => {
      const memory = baseMemory();
      memory.metadata.tags = [" "];

      const result = serializeOutput({ kind: "memory", value: memory }, "json");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_FIELD");
        expect(result.error.field).toBe("tags");
      }
    });

    it("should reject negative token estimates", () => {
      const memory = baseMemory();
      memory.metadata.tokenEstimate = -1;

      const result = serializeOutput({ kind: "memory", value: memory }, "json");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_FIELD");
        expect(result.error.field).toBe("token_estimate");
      }
    });

    it("should reject negative memory counts", () => {
      const result = serializeOutput(
        {
          kind: "category",
          value: {
            path: "working",
            memories: [],
            subcategories: [{ path: "working/bad", memoryCount: -2 }],
          },
        },
        "json"
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_FIELD");
        expect(result.error.field).toBe("subcategories.memory_count");
      }
    });
  });
});
