import { isValidCIN } from "../validators.js";
import { formatErrorResponse } from "../errors.js";
import { getCached, setCached, cacheKey } from "../cache.js";
import { fetchDirectorsByCin } from "../providers/mca.js";
import { logger } from "../logger.js";

interface LookupDirectorsArgs {
  cin: string;
  include_resigned?: boolean;
}

export async function lookupDirectors(args: LookupDirectorsArgs) {
  const cin = args.cin.trim().toUpperCase();
  const includeResigned = args.include_resigned ?? false;

  if (!isValidCIN(cin)) {
    return {
      success: false,
      cin,
      error: "Invalid CIN format",
      code: "INVALID_INPUT",
      retryable: false,
    };
  }

  const key = cacheKey("directors", cin, String(includeResigned));
  const cached = await getCached<Record<string, unknown>>(key);
  if (cached) {
    logger.debug("Cache hit for lookup_directors", { cin });
    return { ...cached, cache_hit: true };
  }

  try {
    const data = await fetchDirectorsByCin(cin, "lookup_directors");

    if (!data) {
      return {
        success: false,
        cin,
        error: "No director data found for this CIN",
        code: "NOT_FOUND",
        retryable: false,
      };
    }

    const directors = includeResigned
      ? data.directors
      : data.directors.filter((d) => d.status === "Current");

    const totalCurrent = data.directors.filter((d) => d.status === "Current").length;
    const totalResigned = data.directors.filter((d) => d.status === "Resigned").length;

    const result = {
      success: true,
      cin,
      company_name: data.company_name,
      directors,
      total_current: totalCurrent,
      total_resigned: totalResigned,
      source: data.source,
      fetched_at: new Date().toISOString(),
    };

    await setCached(key, result, "DIRECTORS");
    logger.info("lookup_directors success", { cin, total: directors.length });
    return result;
  } catch (err) {
    return formatErrorResponse(err, "lookup_directors");
  }
}
