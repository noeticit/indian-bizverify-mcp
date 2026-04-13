import { InvalidInputError, formatErrorResponse } from "../errors.js";
import { getCached, setCached, cacheKey } from "../cache.js";
import { searchCompanies } from "../providers/mca.js";
import { logger } from "../logger.js";

interface SearchCompanyArgs {
  company_name: string;
  state?: string;
  company_type?: "PVT" | "PLC" | "OPC" | "LLP" | "SECTION8";
  limit?: number;
}

export async function searchCompany(args: SearchCompanyArgs) {
  const name = args.company_name.trim();
  const state = args.state?.toUpperCase();
  const companyType = args.company_type;
  const limit = Math.min(args.limit ?? 10, 25);

  if (name.length < 3) {
    return {
      success: false,
      error: "Company name must be at least 3 characters",
      code: "INVALID_INPUT",
      retryable: false,
    };
  }

  const key = cacheKey("search", name, state ?? "ALL", companyType ?? "ALL");
  const cached = await getCached<ReturnType<typeof buildResult>>(key);
  if (cached) {
    logger.debug("Cache hit for search_company", { name });
    return { ...cached, cache_hit: true };
  }

  try {
    const { companies, source } = await searchCompanies(name, state, companyType, limit, "search_company");

    const result = buildResult(name, companies, source);
    await setCached(key, result, "COMPANY");
    logger.info("search_company success", { name, total: result.total_found });
    return result;
  } catch (err) {
    return formatErrorResponse(err, "search_company");
  }
}

function buildResult(query: string, companies: Awaited<ReturnType<typeof searchCompanies>>["companies"], source: string) {
  return {
    success: true,
    query,
    total_found: companies.length,
    companies,
    source,
    fetched_at: new Date().toISOString(),
  };
}
