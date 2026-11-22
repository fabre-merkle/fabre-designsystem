import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { registerSearchTool, registerSourceTools } from "fumadocs-core/mcp";
import { createFromSource } from "fumadocs-core/search/server";
import { llmsRenderer } from "../../../lib/llms";
import { source } from "../../../lib/source";

const handler = createMcpHandler(() => {
  const server = new McpServer(
    { name: "docs", version: "1.0.0" },
    { capabilities: { tools: { listChanged: false } } },
  );

  registerSourceTools(server, source, llmsRenderer);
  registerSearchTool(server, createFromSource(source));
  return server;
});

export const GET = (request: Request) => handler.fetch(request);
export const POST = (request: Request) => handler.fetch(request);
export const DELETE = (request: Request) => handler.fetch(request);
