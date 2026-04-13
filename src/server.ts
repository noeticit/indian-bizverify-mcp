import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchCompany } from "./tools/searchCompany.js";
import { verifyCompany } from "./tools/verifyCompany.js";
import { verifyGst } from "./tools/verifyGst.js";
import { lookupDirectors } from "./tools/lookupDirectors.js";
import { verifyPan } from "./tools/verifyPan.js";
import { verifyUdyam } from "./tools/verifyUdyam.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "indian-bizverify",
    version: "1.0.0",
  });

  server.tool(
    "search_company",
    "Search for Indian companies by name. Returns matching companies with CIN, status, and incorporation date. Use this when you only have a company name and need the CIN.",
    {
      company_name: z.string().min(3).describe("Company name to search for (min 3 characters)"),
      state: z.string().length(2).optional().describe("2-letter state code filter"),
      company_type: z.enum(["PVT", "PLC", "OPC", "LLP", "SECTION8"]).optional().describe("Company type filter"),
      limit: z.number().min(1).max(25).optional().describe("Max results to return (default 10, max 25)"),
    },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await searchCompany(args), null, 2) }],
    })
  );

  server.tool(
    "verify_company",
    "Get the full company profile by CIN. Returns incorporation details, registered address, paid-up capital, AGM date, and optionally directors.",
    {
      cin: z.string().describe("Corporate Identification Number (CIN)"),
      include_directors: z.boolean().optional().describe("Include director details (default false)"),
    },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await verifyCompany(args), null, 2) }],
    })
  );

  server.tool(
    "verify_gst",
    "Validate a GSTIN and retrieve taxpayer details including legal name, trade name, registration status, state, and last filing info. Use before raising invoices or onboarding GST-registered vendors.",
    {
      gstin: z.string().describe("GST Identification Number (15 characters)"),
    },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await verifyGst(args), null, 2) }],
    })
  );

  server.tool(
    "lookup_directors",
    "Retrieve current (and optionally past) directors of an Indian company by CIN. Returns DIN, name, designation, and appointment dates.",
    {
      cin: z.string().describe("Corporate Identification Number (CIN)"),
      include_resigned: z.boolean().optional().describe("Include resigned directors (default false)"),
    },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await lookupDirectors(args), null, 2) }],
    })
  );

  server.tool(
    "verify_pan",
    "Validate PAN format and identify the entity type (Individual, Company, Firm, Trust, HUF, etc.). Optionally cross-references linked GSTINs. Does not verify name or DOB — use a KYC API for that.",
    {
      pan: z.string().describe("Permanent Account Number (10 characters)"),
      cross_reference_gst: z.boolean().optional().describe("Cross-reference linked GSTINs (default false)"),
    },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await verifyPan(args), null, 2) }],
    })
  );

  server.tool(
    "verify_udyam",
    "Verify MSME Udyam registration status. Returns enterprise category (Micro/Small/Medium), activity type, district, state, employee count, and investment details.",
    {
      udyam_number: z.string().describe("Udyam registration number (e.g., UDYAM-MH-01-0012345)"),
    },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await verifyUdyam(args), null, 2) }],
    })
  );

  return server;
}
