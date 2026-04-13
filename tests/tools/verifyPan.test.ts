import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyPan } from "../../src/tools/verifyPan.js";

// Mock the cache to avoid DynamoDB calls
vi.mock("../../src/cache.js", () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
  cacheKey: (...parts: string[]) => parts.join(":"),
}));

// Mock the GST provider
vi.mock("../../src/providers/gst.js", () => ({
  fetchGstinsByPan: vi.fn().mockResolvedValue([]),
}));

import { fetchGstinsByPan } from "../../src/providers/gst.js";
const mockFetchGstinsByPan = vi.mocked(fetchGstinsByPan);

describe("verifyPan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns format_valid: false for invalid PAN", async () => {
    const result = await verifyPan({ pan: "INVALID" });
    expect(result.success).toBe(false);
    expect(result.format_valid).toBe(false);
  });

  it("validates PAN and returns entity type", async () => {
    const result = await verifyPan({ pan: "ABCCE1234F" });
    expect(result.success).toBe(true);
    expect(result.format_valid).toBe(true);
    expect(result.entity_type_code).toBe("C");
    expect(result.entity_type).toBe("Company");
    expect(result.linked_gstins).toEqual([]);
    expect(mockFetchGstinsByPan).not.toHaveBeenCalled();
  });

  it("cross-references GST when requested", async () => {
    mockFetchGstinsByPan.mockResolvedValue(["27ABCCE1234F1ZV"]);

    const result = await verifyPan({ pan: "ABCCE1234F", cross_reference_gst: true });
    expect(result.success).toBe(true);
    expect(result.linked_gstins).toEqual(["27ABCCE1234F1ZV"]);
    expect(mockFetchGstinsByPan).toHaveBeenCalledWith("ABCCE1234F", "verify_pan");
  });

  it("identifies Individual PAN", async () => {
    const result = await verifyPan({ pan: "ABCPE1234F" });
    expect(result.entity_type_code).toBe("P");
    expect(result.entity_type).toBe("Individual");
  });
});
