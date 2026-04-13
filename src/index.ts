import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";

// Singleton — reused across warm Lambda invocations
let server: ReturnType<typeof createServer> | null = null;
function getServer() {
  return (server ??= createServer());
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  // Health check
  if (event.rawPath === "/health") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ok", service: "indian-bizverify-mcp", version: "1.0.0" }),
    };
  }

  if (!event.rawPath.startsWith("/mcp")) {
    return { statusCode: 404, body: '{"error":"Not Found"}' };
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: true,
  });

  await getServer().connect(transport);

  // Build a Web Standard Request from the API Gateway event
  const url = `https://${event.requestContext.domainName}${event.rawPath}${event.rawQueryString ? "?" + event.rawQueryString : ""}`;
  const request = new Request(url, {
    method: event.requestContext.http.method,
    headers: event.headers as Record<string, string>,
    body: event.body ?? undefined,
  });

  const response = await transport.handleRequest(request);

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    statusCode: response.status,
    headers: responseHeaders,
    body: await response.text(),
  };
};
