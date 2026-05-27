import { describe, expect, it } from "vitest";
import { createWebhookSchema, updateWebhookSchema, WEBHOOK_EVENTS } from "./webhook";

describe("createWebhookSchema", () => {
  const valid = {
    name: "ops-channel",
    url: "https://example.com/hook",
    events: ["receipt.created"] as const,
  };

  it("accepts minimal valid input + default enabled=true", () => {
    const r = createWebhookSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.enabled).toBe(true);
  });

  it("rejects empty events array", () => {
    expect(createWebhookSchema.safeParse({ ...valid, events: [] }).success).toBe(false);
  });

  it("rejects unknown event names", () => {
    expect(createWebhookSchema.safeParse({ ...valid, events: ["receipt.exploded"] }).success).toBe(false);
  });

  it("rejects non-URL url", () => {
    expect(createWebhookSchema.safeParse({ ...valid, url: "not-a-url" }).success).toBe(false);
  });

  it("accepts every known event", () => {
    for (const e of WEBHOOK_EVENTS) {
      const r = createWebhookSchema.safeParse({ ...valid, events: [e] });
      expect(r.success).toBe(true);
    }
  });

  it("accepts multiple events", () => {
    const r = createWebhookSchema.safeParse({
      ...valid,
      events: ["receipt.created", "receipt.blocked", "approval.decided"],
    });
    expect(r.success).toBe(true);
  });
});

describe("updateWebhookSchema", () => {
  it("accepts empty object", () => {
    expect(updateWebhookSchema.safeParse({}).success).toBe(true);
  });

  it("rejects partial events array if events present but empty", () => {
    expect(updateWebhookSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it("accepts partial enabled toggle", () => {
    expect(updateWebhookSchema.safeParse({ enabled: false }).success).toBe(true);
  });
});

describe("WEBHOOK_EVENTS", () => {
  it("exports exactly 5 events (v0.8 scope)", () => {
    expect(WEBHOOK_EVENTS.length).toBe(5);
  });

  it("includes the high-level signal events", () => {
    expect(WEBHOOK_EVENTS).toContain("receipt.created");
    expect(WEBHOOK_EVENTS).toContain("receipt.blocked");
    expect(WEBHOOK_EVENTS).toContain("approval.requested");
    expect(WEBHOOK_EVENTS).toContain("approval.decided");
  });
});
