import { describe, expect, it } from "vitest";
import { createToolSchema, updateToolSchema } from "./tool";

describe("createToolSchema", () => {
  const valid = {
    name: "openai-responses",
    endpoint: "https://api.openai.com/v1/responses",
  };

  it("accepts minimal valid input + applies defaults", () => {
    const r = createToolSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.kind).toBe("http");
      expect(r.data.method).toBe("POST");
      expect(r.data.defaultCostUsd).toBe(0);
      expect(r.data.enabled).toBe(true);
      expect(r.data.description).toBe("");
    }
  });

  it("requires endpoint to be a URL", () => {
    const r = createToolSchema.safeParse({ ...valid, endpoint: "not-a-url" });
    expect(r.success).toBe(false);
  });

  it("rejects uppercase letters in name (slug-only)", () => {
    expect(createToolSchema.safeParse({ ...valid, name: "OpenAI-Tool" }).success).toBe(false);
  });

  it("rejects names starting with digit/dash", () => {
    expect(createToolSchema.safeParse({ ...valid, name: "1-tool" }).success).toBe(false);
    expect(createToolSchema.safeParse({ ...valid, name: "-tool" }).success).toBe(false);
  });

  it("accepts lowercase letters / digits / dashes / underscores", () => {
    for (const name of ["abc", "a-b", "tool_123", "my-tool-v2"]) {
      expect(createToolSchema.safeParse({ ...valid, name }).success).toBe(true);
    }
  });

  it("rejects unknown HTTP method", () => {
    expect(createToolSchema.safeParse({ ...valid, method: "TRACE" }).success).toBe(false);
  });

  it("rejects negative defaultCostUsd", () => {
    expect(createToolSchema.safeParse({ ...valid, defaultCostUsd: -1 }).success).toBe(false);
  });

  it("only allows kind=http for now", () => {
    expect(createToolSchema.safeParse({ ...valid, kind: "mcp" }).success).toBe(false);
  });
});

describe("updateToolSchema", () => {
  it("accepts empty object (no-op patch)", () => {
    expect(updateToolSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial fields", () => {
    expect(updateToolSchema.safeParse({ enabled: false }).success).toBe(true);
    expect(updateToolSchema.safeParse({ defaultCostUsd: 0.5 }).success).toBe(true);
  });

  it("still validates partial fields it does receive", () => {
    expect(updateToolSchema.safeParse({ endpoint: "not-url" }).success).toBe(false);
    expect(updateToolSchema.safeParse({ name: "INVALID UPPER" }).success).toBe(false);
  });
});
