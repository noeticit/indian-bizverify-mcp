import { isValidGSTIN, getStateFromGSTIN } from "../validators.js";
import { formatErrorResponse } from "../errors.js";
import { getCached, setCached, cacheKey } from "../cache.js";
import { fetchGstDetails } from "../providers/gst.js";
import { logger } from "../logger.js";

interface VerifyGstArgs {
  gstin: string;
}

export async function verifyGst(args: VerifyGstArgs) {
  const gstin = args.gstin.trim().toUpperCase();

  if (!isValidGSTIN(gstin)) {
    return {
      success: false,
      gstin,
      format_valid: false,
      error: "Invalid GSTIN format or checksum. Expected: [2-digit state][PAN][entity][Z][check]",
      source: "format_validation",
      fetched_at: new Date().toISOString(),
    };
  }

  const key = cacheKey("gst", gstin);
  const cached = await getCached<Record<string, unknown>>(key);
  if (cached) {
    logger.debug("Cache hit for verify_gst", { gstin });
    return { ...cached, cache_hit: true };
  }

  try {
    const taxpayer = await fetchGstDetails(gstin, "verify_gst");

    if (!taxpayer) {
      return {
        success: false,
        gstin,
        format_valid: true,
        error: "GSTIN not found or not registered",
        source: "GST Portal",
        fetched_at: new Date().toISOString(),
      };
    }

    const stateInfo = getStateFromGSTIN(gstin);
    taxpayer.state = stateInfo.name;

    const result = {
      success: true,
      gstin,
      format_valid: true,
      taxpayer,
      source: "GST Portal",
      fetched_at: new Date().toISOString(),
    };

    await setCached(key, result, "GST");
    logger.info("verify_gst success", { gstin, status: taxpayer.status });
    return result;
  } catch (err) {
    return formatErrorResponse(err, "verify_gst");
  }
}
