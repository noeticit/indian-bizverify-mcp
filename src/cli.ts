#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { logger } from "./logger.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Indian BizVerify MCP server running on stdio");
}

main().catch((err) => {
  logger.error("Fatal error starting server", { error: String(err) });
  process.exit(1);
});
