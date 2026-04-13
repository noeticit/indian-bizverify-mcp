import { isValidUdyamNumber } from "../validators.js";
import { formatErrorResponse } from "../errors.js";
import { getCached, setCached, cacheKey } from "../cache.js";
import { fetchUdyamDetails } from "../providers/udyam.js";
import { logger } from "../logger.js";

interface VerifyUdyamArgs {
  udyam_number: string;
}

export async function verifyUdyam(args: VerifyUdyamArgs) {
  const udyamNumber = args.udyam_number.trim().toUpperCase();

  if (!isValidUdyamNumber(udyamNumber)) {
    return {
      success: false,
      udyam_number: udyamNumber,
      error: "Invalid Udyam number format. Expected: UDYAM-[2-char state]-[2-digit]-[7-digit]",
      source: "format_validation",
      fetched_at: new Date().toISOString(),
    };
  }

  const key = cacheKey("udyam", udyamNumber);
  const cached = await getCached<Record<string, unknown>>(key);
  if (cached) {
    logger.debug("Cache hit for verify_udyam", { udyamNumber });
    return { ...cached, cache_hit: true };
  }

  try {
    const registration = await fetchUdyamDetails(udyamNumber, "verify_udyam");

    if (!registration) {
      return {
        success: false,
        udyam_number: udyamNumber,
        error: "Udyam registration not found or could not be verified",
        source: "Udyam Portal",
        fetched_at: new Date().toISOString(),
      };
    }

    const result = {
      success: true,
      udyam_number: udyamNumber,
      registration,
      source: "Udyam Portal",
      fetched_at: new Date().toISOString(),
    };

    await setCached(key, result, "UDYAM");
    logger.info("verify_udyam success", { udyamNumber, category: registration.category });
    return result;
  } catch (err) {
    return formatErrorResponse(err, "verify_udyam");
  }
}
