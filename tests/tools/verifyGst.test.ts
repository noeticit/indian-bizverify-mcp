import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyGst } from "../../src/tools/verifyGst.js";

// Mock the cache to avoid DynamoDB calls
vi.mock("../../src/cache.js", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  cacheKey: (...parts: string[]) => parts.join(":"),
}));

// Mock the GST provider
vi.mock("../../src/providers/gst.js", () => ({
  fetchGstDetails: vi.fn(),
}));

import { fetchGstDetails } from "../../src/providers/gst.js";
const mockFetchGstDetails = vi.mocked(fetchGstDetails);

describe("verifyGst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns format_valid: false for invalid GSTIN", async () => {
    const result = await verifyGst({ gstin: "INVALID" });
    expect(result.success).toBe(false);
    expect(result.format_valid).toBe(false);
    expect(mockFetchGstDetails).not.toHaveBeenCalled();
  });

  it("returns taxpayer details for valid GSTIN", async () => {
    mockFetchGstDetails.mockResolvedValue({
      legal_name: "ACME TECHNOLOGIES PRIVATE LIMITED",
      trade_name: "Acme Tech",
      registration_date: "2017-07-01",
      status: "Active",
      taxpayer_type: "Regular",
      constitution: "Private Limited Company",
      state: "",
      state_code: "27",
      pan_embedded: "AAPFU0939F",
      principal_place_of_business: {
        address: "Plot 42, MIDC Industrial Area, Pune, Pune",
        city: "Pune",
        state: null,
        pincode: "411018",
      },
      filing_status: {
        last_return_type: null,
        last_return_period: null,
        last_filed_on: null,
      },
    });

    const result = await verifyGst({ gstin: "27AAPFU0939F1ZV" });
    expect(result.success).toBe(true);
    expect(result.format_valid).toBe(true);
    expect(result.taxpayer?.legal_name).toBe("ACME TECHNOLOGIES PRIVATE LIMITED");
    expect(result.taxpayer?.state).toBe("Maharashtra");
  });

  it("returns not found when provider returns null", async () => {
    mockFetchGstDetails.mockResolvedValue(null);

    const result = await verifyGst({ gstin: "27AAPFU0939F1ZV" });
    expect(result.success).toBe(false);
    expect(result.format_valid).toBe(true);
    expect(result.error).toContain("not found");
  });
});
