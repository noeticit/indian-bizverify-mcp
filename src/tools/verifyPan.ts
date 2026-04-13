import { isValidPAN, getPANEntityType } from "../validators.js";
import { formatErrorResponse } from "../errors.js";
import { getCached, setCached, cacheKey } from "../cache.js";
import { fetchGstinsByPan } from "../providers/gst.js";
import { logger } from "../logger.js";

interface VerifyPanArgs {
  pan: string;
  cross_reference_gst?: boolean;
}

export async function verifyPan(args: VerifyPanArgs) {
  const pan = args.pan.trim().toUpperCase();
  const crossRefGst = args.cross_reference_gst ?? false;

  if (!isValidPAN(pan)) {
    return {
      success: false,
      pan,
      format_valid: false,
      error: "Invalid PAN format. Expected: [5 alpha][4 digits][1 alpha]",
      source: "format_validation",
      fetched_at: new Date().toISOString(),
    };
  }

  const key = cacheKey("pan", pan, String(crossRefGst));
  const cached = await getCached<Record<string, unknown>>(key);
  if (cached) {
    logger.debug("Cache hit for verify_pan", { pan });
    return { ...cached, cache_hit: true };
  }

  try {
    const entityType = getPANEntityType(pan);
    const linkedGstins = crossRefGst ? await fetchGstinsByPan(pan, "verify_pan") : [];

    const result = {
      success: true,
      pan,
      format_valid: true,
      entity_type_code: entityType.code,
      entity_type: entityType.description,
      state_of_issuance: null,
      linked_gstins: linkedGstins,
      note: "Full name/DOB verification requires KYC API",
      source: crossRefGst ? "format_validation + GST Portal" : "format_validation",
      fetched_at: new Date().toISOString(),
    };

    await setCached(key, result, "PAN");
    logger.info("verify_pan success", { pan, entity_type: entityType.description });
    return result;
  } catch (err) {
    return formatErrorResponse(err, "verify_pan");
  }
}
