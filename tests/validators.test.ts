import { describe, it, expect } from "vitest";
import {
  isValidCIN,
  isValidGSTIN,
  validateGSTINChecksum,
  isValidPAN,
  getPANEntityType,
  isValidUdyamNumber,
  getStateFromGSTIN,
  GSTIN_STATE_CODES,
} from "../src/validators.js";

describe("isValidCIN", () => {
  it("accepts a valid CIN", () => {
    expect(isValidCIN("U72900MH2017PTC123456")).toBe(true);
    expect(isValidCIN("L01631KA2010PLC096843")).toBe(true);
  });

  it("rejects invalid CINs", () => {
    expect(isValidCIN("")).toBe(false);
    expect(isValidCIN("X72900MH2017PTC123456")).toBe(false); // starts with X
    expect(isValidCIN("U7290MH2017PTC123456")).toBe(false); // 4-digit NIC
    expect(isValidCIN("U72900MH2017PTC12345")).toBe(false); // 5-digit seq
  });
});

describe("isValidGSTIN", () => {
  it("validates format and checksum", () => {
    // 27AAPFU0939F1ZV is a known valid GSTIN
    expect(isValidGSTIN("27AAPFU0939F1ZV")).toBe(true);
  });

  it("rejects invalid format", () => {
    expect(isValidGSTIN("")).toBe(false);
    expect(isValidGSTIN("INVALIDGSTIN123")).toBe(false);
    expect(isValidGSTIN("27AAPFU0939F1Z")).toBe(false); // too short
  });
});

describe("validateGSTINChecksum", () => {
  it("validates correct checksum", () => {
    expect(validateGSTINChecksum("27AAPFU0939F1ZV")).toBe(true);
  });

  it("rejects incorrect checksum", () => {
    expect(validateGSTINChecksum("27AAPFU0939F1ZX")).toBe(false);
  });
});

describe("isValidPAN", () => {
  it("accepts valid PANs", () => {
    expect(isValidPAN("ABCDE1234F")).toBe(true);
    expect(isValidPAN("AABCC1234D")).toBe(true);
  });

  it("rejects invalid PANs", () => {
    expect(isValidPAN("")).toBe(false);
    expect(isValidPAN("ABCDE1234")).toBe(false); // 9 chars
    expect(isValidPAN("12345ABCDE")).toBe(false); // starts with digits
    expect(isValidPAN("abcde1234f")).toBe(false); // lowercase
  });
});

describe("getPANEntityType", () => {
  it("identifies entity types correctly", () => {
    expect(getPANEntityType("ABCPE1234F")).toEqual({ code: "P", description: "Individual" });
    expect(getPANEntityType("ABCCE1234F")).toEqual({ code: "C", description: "Company" });
    expect(getPANEntityType("ABCHE1234F")).toEqual({ code: "H", description: "HUF" });
    expect(getPANEntityType("ABCFE1234F")).toEqual({ code: "F", description: "Firm" });
    expect(getPANEntityType("ABCTE1234F")).toEqual({ code: "T", description: "Trust" });
  });
});

describe("isValidUdyamNumber", () => {
  it("accepts valid Udyam numbers", () => {
    expect(isValidUdyamNumber("UDYAM-MH-01-0012345")).toBe(true);
    expect(isValidUdyamNumber("UDYAM-KA-02-1234567")).toBe(true);
  });

  it("rejects invalid Udyam numbers", () => {
    expect(isValidUdyamNumber("")).toBe(false);
    expect(isValidUdyamNumber("UDYAM-MH-01-001234")).toBe(false); // 6 digits
    expect(isValidUdyamNumber("UDYAM-mh-01-0012345")).toBe(false); // lowercase
    expect(isValidUdyamNumber("MH-01-0012345")).toBe(false); // missing prefix
  });
});

describe("getStateFromGSTIN", () => {
  it("returns state info from GSTIN", () => {
    expect(getStateFromGSTIN("27AAPFU0939F1ZV")).toEqual({ code: "27", name: "Maharashtra" });
    expect(getStateFromGSTIN("07AAPFU0939F1ZV")).toEqual({ code: "07", name: "Delhi" });
  });

  it("returns Unknown for invalid state code", () => {
    expect(getStateFromGSTIN("99AAPFU0939F1ZV")).toEqual({ code: "99", name: "Unknown" });
  });
});

describe("GSTIN_STATE_CODES", () => {
  it("has expected entries", () => {
    expect(GSTIN_STATE_CODES["27"]).toBe("Maharashtra");
    expect(GSTIN_STATE_CODES["07"]).toBe("Delhi");
    expect(GSTIN_STATE_CODES["33"]).toBe("Tamil Nadu");
  });
});
