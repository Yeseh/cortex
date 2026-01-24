import { describe, expect, it } from "bun:test";

import { parseStoreRegistry } from "../src/store/registry.ts";

describe("store registry parsing", () => {
  it("should parse top-level store entries", () => {
    const raw = [
      "primary:",
      "  path: /var/lib/cortex",
      "secondary:",
      "  path: /var/lib/cortex-secondary",
    ].join("\n");

    const result = parseStoreRegistry(raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        primary: { path: "/var/lib/cortex" },
        secondary: { path: "/var/lib/cortex-secondary" },
      });
    }
  });

  it("should parse stores section entries", () => {
    const raw = [
      "stores:",
      "  local:",
      "    path: ./data/.cortex # comment",
      "  global:",
      "    path: 'C:/Cortex Global'",
    ].join("\n");

    const result = parseStoreRegistry(raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        local: { path: "./data/.cortex" },
        global: { path: "C:/Cortex Global" },
      });
    }
  });

  it("should reject stores section not at top level", () => {
    const raw = ["  stores:", "    local:", "      path: ./data"].join("\n");

    const result = parseStoreRegistry(raw);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_STORES_SECTION");
      expect(result.error.line).toBe(1);
    }
  });

  it("should reject store names with invalid characters", () => {
    const raw = ["stores:", "  bad_name:", "    path: /var/lib/cortex"].join(
      "\n"
    );

    const result = parseStoreRegistry(raw);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ENTRY");
      expect(result.error.line).toBe(2);
    }
  });

  it("should reject duplicate store names", () => {
    const raw = [
      "primary:",
      "  path: /var/lib/cortex",
      "primary:",
      "  path: /var/lib/duplicate",
    ].join("\n");

    const result = parseStoreRegistry(raw);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DUPLICATE_STORE_NAME");
      expect(result.error.store).toBe("primary");
    }
  });

  it("should reject missing store paths", () => {
    const raw = ["primary:", "secondary:", "  path: /var/lib/cortex"].join(
      "\n"
    );

    const result = parseStoreRegistry(raw);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_STORE_PATH");
      expect(result.error.store).toBe("primary");
    }
  });

  it("should reject empty or comment-only path values", () => {
    const raw = ["primary:", "  path: # empty"].join("\n");

    const result = parseStoreRegistry(raw);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_STORE_PATH");
      expect(result.error.store).toBe("primary");
    }
  });

  it("should reject unexpected entries", () => {
    const raw = ["stores:", "  primary:", "    path: /var/lib", "  extra: true"].join(
      "\n"
    );

    const result = parseStoreRegistry(raw);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNEXPECTED_ENTRY");
      expect(result.error.line).toBe(4);
    }
  });

  it("should reject paths that are not indented under the store", () => {
    const raw = ["primary:", "path: /var/lib"].join("\n");

    const result = parseStoreRegistry(raw);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_STORE_PATH");
      expect(result.error.store).toBe("primary");
    }
  });
});
