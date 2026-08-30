#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const apiUrl = process.env.TABLENOW_API_URL || "http://localhost:4000";
const nodeToken = process.env.TABLENOW_NODE_TOKEN;
if (!nodeToken) throw new Error("TABLENOW_NODE_TOKEN is required");

const server = new McpServer({ name: "tablenow", version: "0.1.0" });

server.registerTool(
  "get_today_summary",
  {
    title: "Get today's restaurant summary",
    description: "Returns current occupancy, open decisions, reservations, operations and stock alerts for the authenticated TableNow tenant.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    const workspace = await api<Record<string, unknown>>("/v1/workspace");
    return textResult(JSON.stringify(workspace, null, 2));
  },
);

server.registerTool(
  "list_open_decisions",
  {
    title: "List decisions requiring attention",
    description: "Lists unresolved operational decisions. This tool never approves or rejects them.",
    inputSchema: { priority: z.enum(["all", "critical", "high", "medium", "low"]).default("all") },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ priority }) => {
    const workspace = await api<{ decisions?: Array<{ priority?: string; status?: string }> }>("/v1/workspace");
    const decisions = (workspace.decisions || []).filter((decision) => decision.status === "open" && (priority === "all" || decision.priority === priority));
    return textResult(JSON.stringify(decisions, null, 2));
  },
);

server.registerTool(
  "ask_copilot",
  {
    title: "Ask TableNow Copilot",
    description: "Gets a grounded answer and may create a proposed action. Proposed actions remain blocked until an authorized human approves them in TableNow.",
    inputSchema: { message: z.string().min(2).max(4000) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ message }) => {
    const reply = await api<Record<string, unknown>>("/v1/copilot/messages", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    return textResult(JSON.stringify(reply, null, 2));
  },
);

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${nodeToken}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json() as T & { error?: unknown };
  if (!response.ok) throw new Error(`TableNow API ${response.status}: ${JSON.stringify(body.error || body)}`);
  return body;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

await server.connect(new StdioServerTransport());
