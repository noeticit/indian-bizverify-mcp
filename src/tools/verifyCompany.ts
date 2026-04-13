import { isValidCIN } from "../validators.js";
import { formatErrorResponse } from "../errors.js";
import { getCached, setCached, cacheKey } from "../cache.js";
import { fetchCompanyByCin, fetchDirectorsByCin } from "../providers/mca.js";
import { logger } from "../logger.js";

interface VerifyCompanyArgs {
  cin: string;
  include_directors?: boolean;
}

export async function verifyCompany(args: VerifyCompanyArgs) {
  const cin = args.cin.trim().toUpperCase();
  const includeDirectors = args.include_directors ?? false;

  if (!isValidCIN(cin)) {
    return {
      success: false,
      cin,
      error: "Invalid CIN format. Expected: [L/U][5-digit NIC][2-char state][4-digit year][3-char type][6-digit seq]",
      code: "INVALID_INPUT",
      retryable: false,
    };
  }

  const key = cacheKey("company", cin);
  const cached = await getCached<Record<string, unknown>>(key);
  if (cached) {
    logger.debug("Cache hit for verify_company", { cin });
    return { ...cached, cache_hit: true };
  }

  try {
    const companyResult = fetchCompanyByCin(cin, "verify_company");
    const directorsResult = includeDirectors
      ? fetchDirectorsByCin(cin, "verify_company")
      : Promise.resolve(null);

    const [companyData, directorsData] = await Promise.all([companyResult, directorsResult]);

    if (!companyData) {
      return {
        success: false,
        cin,
        error: "Company not found for the given CIN",
        code: "NOT_FOUND",
        retryable: false,
      };
    }

    const result = {
      success: true,
      cin,
      company: companyData.company,
      directors: directorsData?.directors ?? null,
      source: companyData.source,
      fetched_at: new Date().toISOString(),
    };

    await setCached(key, result, "COMPANY");
    logger.info("verify_company success", { cin, name: companyData.company.name });
    return result;
  } catch (err) {
    return formatErrorResponse(err, "verify_company");
  }
}
