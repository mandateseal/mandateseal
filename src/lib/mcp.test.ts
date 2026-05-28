import { describe, it, expect } from "vitest";
import {
  parseRpcRequest,
  rpcError,
  rpcResult,
  toMcpTool,
  buildInitializeResult,
  RPC_ERRORS,
  MCP_PROTOCOL_VERSION,
} from "./mcp";

describe("parseRpcRequest", () => {
  it("accepts a well-formed request", () => {
    const r = parseRpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.req.method).toBe("tools/list");
      expect(r.req.id).toBe(1);
    }
  });

  it("rejects non-object body", () => {
    const r = parseRpcRequest("not an object");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.error?.code).toBe(RPC_ERRORS.INVALID_REQUEST);
  });

  it("rejects missing jsonrpc version", () => {
    const r = parseRpcRequest({ id: 1, method: "tools/list" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.error?.message).toContain("jsonrpc");
  });

  it("rejects missing method", () => {
    const r = parseRpcRequest({ jsonrpc: "2.0", id: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.error?.message).toContain("method");
  });

  it("preserves request id on error response", () => {
    const r = parseRpcRequest({ jsonrpc: "2.0", id: "abc-123" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.id).toBe("abc-123");
  });

  it("accepts null id (notification-style)", () => {
    const r = parseRpcRequest({ jsonrpc: "2.0", id: null, method: "notifications/initialized" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.req.id).toBe(null);
  });

  it("defaults params to {} when omitted", () => {
    const r = parseRpcRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.req.params).toEqual({});
  });
});

describe("rpcError / rpcResult", () => {
  it("error envelope shape", () => {
    const e = rpcError(7, RPC_ERRORS.METHOD_NOT_FOUND, "unknown method", { method: "foo" });
    expect(e).toEqual({
      jsonrpc: "2.0",
      id: 7,
      error: { code: -32601, message: "unknown method", data: { method: "foo" } },
    });
  });

  it("result envelope shape", () => {
    const r = rpcResult("x", { ok: true });
    expect(r).toEqual({ jsonrpc: "2.0", id: "x", result: { ok: true } });
  });

  it("omits data field when undefined", () => {
    const e = rpcError(1, RPC_ERRORS.INVALID_PARAMS, "bad");
    expect(e.error?.data).toBeUndefined();
  });
});

describe("toMcpTool", () => {
  it("converts a Tool row into the MCP shape", () => {
    const mcp = toMcpTool({
      id: "tool_x",
      name: "web_search",
      description: "Search the web for things.",
      endpoint: "https://search.example.com",
      method: "POST",
      defaultCostUsd: 0,
      enabled: true,
    });
    expect(mcp.name).toBe("web_search");
    expect(mcp.description).toContain("Search the web");
    expect(mcp.inputSchema.type).toBe("object");
  });

  it("falls back to endpoint-based description when blank", () => {
    const mcp = toMcpTool({
      id: "tool_x",
      name: "n",
      description: "",
      endpoint: "https://ep.example.com",
      method: "POST",
      defaultCostUsd: 0,
      enabled: true,
    });
    expect(mcp.description).toContain("https://ep.example.com");
  });
});

describe("buildInitializeResult", () => {
  it("returns the MCP protocol version + server info + capabilities", () => {
    const r = buildInitializeResult() as {
      protocolVersion: string;
      serverInfo: { name: string };
      capabilities: { tools: { listChanged: boolean } };
    };
    expect(r.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(r.serverInfo.name).toBe("mandateseal");
    expect(r.capabilities.tools.listChanged).toBe(false);
  });
});
