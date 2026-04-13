# Indian BizVerify MCP

An MCP (Model Context Protocol) server for verifying Indian business entities in real time. Verify companies (MCA/CIN), GST registrations, PAN, directors, and MSME Udyam registrations — all from free government data sources.

## Quick Start

Run directly without installing:

```bash
npx indian-bizverify-mcp
```

Or install globally:

```bash
npm install -g indian-bizverify-mcp
indian-bizverify-mcp
```

### Use with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "indian-bizverify": {
      "command": "npx",
      "args": ["-y", "indian-bizverify-mcp"]
    }
  }
}
```

### Use with Claude Code

```bash
claude mcp add indian-bizverify -- npx -y indian-bizverify-mcp
```

## Tools

| Tool | Description |
|---|---|
| `search_company` | Search for Indian companies by name. Returns matching companies with CIN, status, and incorporation date. |
| `verify_company` | Get the full company profile by CIN. Returns incorporation details, registered address, paid-up capital, AGM date, and optionally directors. |
| `verify_gst` | Validate a GSTIN and retrieve taxpayer details including legal name, trade name, registration status, state, and last filing info. |
| `lookup_directors` | Retrieve current (and optionally past) directors of an Indian company by CIN. Returns DIN, name, designation, and appointment dates. |
| `verify_pan` | Validate PAN format and identify the entity type (Individual, Company, Firm, Trust, HUF, etc.). Optionally cross-references linked GSTINs. |
| `verify_udyam` | Verify MSME Udyam registration status. Returns enterprise category, activity type, district, state, employee count, and investment details. |

## Tech Stack

- **Language:** TypeScript (ES2022, ESM)
- **Runtime:** Node.js 20.x (arm64 / Graviton2)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Validation:** `zod`
- **HTTP client:** `axios`
- **Cache:** `lru-cache` (in-memory) + DynamoDB TTL
- **Scraping fallback:** `playwright` + `playwright-aws-lambda`
- **Deployment:** AWS SAM (`template.yaml`)
- **Region:** `ap-south-1` (Mumbai)
- **Tests:** `vitest`

## Project Structure

```
bizverify-mcp/
├── package.json
├── tsconfig.json
├── template.yaml               ← AWS SAM
├── .env.example
├── .gitignore
│
├── src/
│   ├── cli.ts                  ← CLI entry point (npx / stdio)
│   ├── index.ts                ← Lambda handler
│   ├── server.ts               ← MCP server + tool registrations
│   ├── tools/
│   │   ├── searchCompany.ts
│   │   ├── verifyCompany.ts
│   │   ├── verifyGst.ts
│   │   ├── lookupDirectors.ts
│   │   ├── verifyPan.ts
│   │   └── verifyUdyam.ts
│   ├── providers/
│   │   ├── mca.ts              ← MCA21 API + data.gov.in fallback
│   │   ├── gst.ts              ← GST portal public API
│   │   └── udyam.ts            ← Udyam portal scraper
│   ├── cache.ts                ← LRU + DynamoDB TTL cache
│   ├── validators.ts           ← Format validators (CIN, GSTIN, PAN, Udyam)
│   ├── errors.ts               ← Typed error classes
│   └── logger.ts               ← Structured JSON logger
│
└── tests/
    ├── validators.test.ts
    ├── tools/
    │   ├── verifyGst.test.ts
    │   └── verifyPan.test.ts
    └── fixtures/
        ├── gst_active.json
        ├── gst_cancelled.json
        ├── company_active.json
        └── udyam_micro.json
```

## Setup

### Prerequisites

- Node.js 20+

### Install

```bash
npm install
```

### API Credentials

The server uses free government APIs and portals. No credentials are required to get started — the GST public API and Udyam scraper work without keys. For broader coverage, obtain the free API keys below.

Copy `.env.example` and fill in your keys:

```bash
cp .env.example .env
```

#### MCA21 API Key (free)

Used for company search, company verification, and director lookup via the Ministry of Corporate Affairs.

1. Go to the MCA portal: https://www.mca.gov.in/
2. Click **"Register"** (top right) and create a Business User account
3. Complete email and mobile verification
4. Once logged in, navigate to **MCA Services > MDS** (Master Data Services)
5. Your API token is available under your profile / API access section
6. Set `MCA_API_KEY` in your `.env`

#### data.gov.in API Key (free)

Fallback data source for company master data from the Open Government Data Platform.

1. Go to: https://data.gov.in/user/register
2. Register with your email (no organization required)
3. Verify your email address
4. Once logged in, go to your profile and find your **API Key** under account settings
5. Set `DATA_GOV_API_KEY` in your `.env`

The company master dataset used is: [MCA Company Master Data](https://data.gov.in/resource/5c6c25f7-9a5c-4c49-a4ef-2d26a3ea8e27)

#### GST Portal (no key required)

The `verify_gst` and PAN cross-reference tools use the GST portal's public taxpayer search API at `services.gst.gov.in`. No registration or API key is needed. Rate limit is approximately 60 requests/minute.

#### Udyam Portal (no key required)

The `verify_udyam` tool scrapes the official Udyam registration verification page at https://udyamregistration.gov.in/udyam-verify using Playwright. No registration or API key is needed.

#### Optional: Premium KYC APIs

For production use with higher rate limits and richer data (name/DOB verification on PAN, etc.), you can plug in a commercial KYC provider. Set any one of these in your `.env`:

| Provider | Sign up | Env var |
|---|---|---|
| Karza | https://karza.in/ | `KARZA_API_KEY` |
| Signzy | https://signzy.com/ | `SIGNZY_API_KEY` |
| IDfy | https://idfy.com/ | `IDFY_API_KEY` |

These are paid services — contact them directly for pricing and API access.

### Provider Selection Logic

At startup, the server checks which keys are set and uses the first available:

- **MCA data:** `KARZA_API_KEY` → `SIGNZY_API_KEY` → `IDFY_API_KEY` → `MCA_API_KEY` (official) → scraper
- **GST data:** `KARZA_API_KEY` → GST portal public API (no key) → scraper
- **PAN data:** `KARZA_API_KEY` → format validation only (no key)
- **Udyam data:** Udyam portal scraper (no key, no official API exists)

## Development

```bash
# Build TypeScript
npm run build

# Run locally (stdio transport)
npm run dev

# Type-check without compiling
npm run lint

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Disclaimer

This project was generated with the assistance of [Claude](https://claude.ai), an AI assistant by Anthropic. The code is provided **as-is**, without warranty of any kind, express or implied. The authors and contributors accept **no responsibility or liability** for any errors, inaccuracies, data loss, or damages arising from the use of this software.

This tool queries third-party government portals and APIs (MCA, GST, Udyam) that may change without notice. Verification results are informational only and should **not** be treated as legally authoritative. Always cross-check with official government sources before making business or legal decisions.

**Use at your own risk.**

## License

MIT
