import axios from "axios";
import { RateLimitError, DataSourceError } from "../errors.js";
import { logger } from "../logger.js";

const MCA_API_BASE = "https://www.mca.gov.in/MCA21/mdsws/MDS";
const DATA_GOV_BASE = "https://api.data.gov.in/resource";
const DATA_GOV_RESOURCE_ID = "5c6c25f7-9a5c-4c49-a4ef-2d26a3ea8e27";

interface McaRawCompany {
  COMPANY_NAME?: string;
  CIN?: string;
  COMPANY_STATUS?: string;
  DATE_OF_INCORPORATION?: string;
  REGISTRAR_OF_COMPANIES?: string;
  AUTHORISED_CAP?: string;
  PAIDUP_CAPITAL?: string;
  REGISTERED_ADDRESS?: string;
  DATE_OF_LAST_AGM?: string;
  DATE_OF_BALANCE_SHEET?: string;
  COMPANY_TYPE?: string;
  COMPANY_CATEGORY?: string;
  COMPANY_SUB_CATEGORY?: string;
  LISTING_STATUS?: string;
  EMAIL?: string;
}

interface McaRawDirector {
  DIN?: string;
  DIRECTOR_NAME?: string;
  DESIGNATION?: string;
  DATE_OF_APPOINTMENT?: string;
  DATE_OF_CESSATION?: string;
  NATIONALITY?: string;
}

function convertDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function parseAddress(address: string | undefined) {
  if (!address) return { address: "", city: "", state: "", pincode: "" };
  const pincodeMatch = address.match(/\b(\d{6})\b/);
  return {
    address,
    city: "",
    state: "",
    pincode: pincodeMatch?.[1] ?? "",
  };
}

export interface CompanyResult {
  name: string;
  cin: string;
  type: string;
  category: string;
  sub_category: string;
  status: string;
  date_of_incorporation: string;
  age_years: number;
  registered_office: {
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  roc: string;
  authorized_capital_inr: number;
  paid_up_capital_inr: number;
  last_agm_date: string | null;
  last_balance_sheet_date: string | null;
  listing_status: "Listed" | "Unlisted";
  email: string | null;
}

export interface DirectorResult {
  din: string;
  name: string;
  designation: string;
  date_of_appointment: string;
  date_of_cessation: string | null;
  status: "Current" | "Resigned";
  nationality: string;
  other_companies_count: number;
}

export interface SearchResult {
  cin: string;
  name: string;
  trade_name: string | null;
  type: string;
  state: string;
  status: string;
  date_of_incorporation: string;
  registered_office: string;
}

function getProvider(): "mca" | "datagov" | "scraper" {
  if (process.env.KARZA_API_KEY) return "mca";
  if (process.env.MCA_API_KEY) return "mca";
  if (process.env.DATA_GOV_API_KEY) return "datagov";
  return "scraper";
}

export async function fetchCompanyByCin(
  cin: string,
  tool: string
): Promise<{ company: CompanyResult; source: string } | null> {
  const provider = getProvider();
  logger.debug("Fetching company by CIN", { cin, provider });

  if (provider === "mca") {
    return fetchFromMca(cin, tool);
  }
  if (provider === "datagov") {
    return fetchFromDataGov(cin, tool);
  }
  // Scraper fallback — return null as scraper requires Playwright which may not be available locally
  logger.warn("No API keys configured, scraper fallback not implemented for local", { cin });
  throw new DataSourceError(tool, "MCA", "No API keys configured. Set MCA_API_KEY or DATA_GOV_API_KEY.");
}

async function fetchFromMca(
  cin: string,
  tool: string
): Promise<{ company: CompanyResult; source: string } | null> {
  const apiKey = process.env.KARZA_API_KEY ?? process.env.MCA_API_KEY;
  try {
    const res = await axios.get<McaRawCompany>(
      `${MCA_API_BASE}/companymaster`,
      { params: { cin, token: apiKey }, timeout: 10000 }
    );
    const data = res.data;
    if (!data.COMPANY_NAME) return null;
    return { company: normalizeCompany(data), source: "MCA21 API" };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 429) throw new RateLimitError(tool, "MCA21");
      throw new DataSourceError(tool, "MCA21", err.message);
    }
    throw new DataSourceError(tool, "MCA21", String(err));
  }
}

async function fetchFromDataGov(
  cin: string,
  tool: string
): Promise<{ company: CompanyResult; source: string } | null> {
  try {
    const res = await axios.get(`${DATA_GOV_BASE}/${DATA_GOV_RESOURCE_ID}`, {
      params: {
        "api-key": process.env.DATA_GOV_API_KEY,
        format: "json",
        "filters[cin]": cin,
        limit: 1,
      },
      timeout: 10000,
    });
    const records = res.data?.records;
    if (!records || records.length === 0) return null;
    return { company: normalizeCompany(records[0]), source: "data.gov.in" };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 429) throw new RateLimitError(tool, "data.gov.in");
      throw new DataSourceError(tool, "data.gov.in", err.message);
    }
    throw new DataSourceError(tool, "data.gov.in", String(err));
  }
}

function normalizeCompany(data: McaRawCompany): CompanyResult {
  const incDate = convertDate(data.DATE_OF_INCORPORATION) ?? "";
  const incYear = incDate ? parseInt(incDate.substring(0, 4), 10) : 0;
  const ageYears = incYear ? new Date().getFullYear() - incYear : 0;

  return {
    name: data.COMPANY_NAME ?? "",
    cin: data.CIN ?? "",
    type: data.COMPANY_TYPE ?? "",
    category: data.COMPANY_CATEGORY ?? "",
    sub_category: data.COMPANY_SUB_CATEGORY ?? "",
    status: data.COMPANY_STATUS ?? "",
    date_of_incorporation: incDate,
    age_years: ageYears,
    registered_office: parseAddress(data.REGISTERED_ADDRESS),
    roc: data.REGISTRAR_OF_COMPANIES ?? "",
    authorized_capital_inr: parseInt(data.AUTHORISED_CAP ?? "0", 10) || 0,
    paid_up_capital_inr: parseInt(data.PAIDUP_CAPITAL ?? "0", 10) || 0,
    last_agm_date: convertDate(data.DATE_OF_LAST_AGM),
    last_balance_sheet_date: convertDate(data.DATE_OF_BALANCE_SHEET),
    listing_status: data.LISTING_STATUS === "Listed" ? "Listed" : "Unlisted",
    email: data.EMAIL || null,
  };
}

export async function fetchDirectorsByCin(
  cin: string,
  tool: string
): Promise<{ directors: DirectorResult[]; company_name: string; source: string } | null> {
  const apiKey = process.env.KARZA_API_KEY ?? process.env.MCA_API_KEY;
  if (!apiKey) {
    throw new DataSourceError(tool, "MCA21", "No API key configured for director lookup.");
  }

  logger.debug("Fetching directors by CIN", { cin });

  try {
    const res = await axios.get<{ directors?: McaRawDirector[]; companyName?: string }>(
      `${MCA_API_BASE}/directormaster`,
      { params: { cin, token: apiKey }, timeout: 10000 }
    );

    const data = res.data;
    const directors = (data.directors ?? []).map((d): DirectorResult => ({
      din: d.DIN ?? "",
      name: d.DIRECTOR_NAME ?? "",
      designation: d.DESIGNATION ?? "",
      date_of_appointment: convertDate(d.DATE_OF_APPOINTMENT) ?? "",
      date_of_cessation: convertDate(d.DATE_OF_CESSATION),
      status: d.DATE_OF_CESSATION ? "Resigned" : "Current",
      nationality: d.NATIONALITY ?? "Indian",
      other_companies_count: 0,
    }));

    return {
      directors,
      company_name: data.companyName ?? "",
      source: "MCA21 API",
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 429) throw new RateLimitError(tool, "MCA21");
      throw new DataSourceError(tool, "MCA21", err.message);
    }
    throw new DataSourceError(tool, "MCA21", String(err));
  }
}

export async function searchCompanies(
  companyName: string,
  state: string | undefined,
  companyType: string | undefined,
  limit: number,
  tool: string
): Promise<{ companies: SearchResult[]; source: string }> {
  const apiKey = process.env.KARZA_API_KEY ?? process.env.MCA_API_KEY;

  if (apiKey) {
    return searchFromMca(companyName, limit, apiKey, tool);
  }

  if (process.env.DATA_GOV_API_KEY) {
    return searchFromDataGov(companyName, limit, tool);
  }

  throw new DataSourceError(tool, "MCA", "No API keys configured for company search.");
}

async function searchFromMca(
  companyName: string,
  limit: number,
  apiKey: string,
  tool: string
): Promise<{ companies: SearchResult[]; source: string }> {
  try {
    const res = await axios.get<{ companies?: McaRawCompany[] }>(
      `${MCA_API_BASE}/companysearch`,
      { params: { companyName, token: apiKey }, timeout: 10000 }
    );

    const companies = (res.data.companies ?? []).slice(0, limit).map(
      (c): SearchResult => ({
        cin: c.CIN ?? "",
        name: c.COMPANY_NAME ?? "",
        trade_name: null,
        type: c.COMPANY_TYPE ?? "",
        state: "",
        status: c.COMPANY_STATUS ?? "",
        date_of_incorporation: convertDate(c.DATE_OF_INCORPORATION) ?? "",
        registered_office: c.REGISTERED_ADDRESS ?? "",
      })
    );

    return { companies, source: "MCA21 API" };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 429) throw new RateLimitError(tool, "MCA21");
      throw new DataSourceError(tool, "MCA21", err.message);
    }
    throw new DataSourceError(tool, "MCA21", String(err));
  }
}

async function searchFromDataGov(
  companyName: string,
  limit: number,
  tool: string
): Promise<{ companies: SearchResult[]; source: string }> {
  try {
    const res = await axios.get(`${DATA_GOV_BASE}/${DATA_GOV_RESOURCE_ID}`, {
      params: {
        "api-key": process.env.DATA_GOV_API_KEY,
        format: "json",
        "filters[company_name]": companyName,
        limit,
      },
      timeout: 10000,
    });

    const records = res.data?.records ?? [];
    const companies = records.map(
      (c: McaRawCompany): SearchResult => ({
        cin: c.CIN ?? "",
        name: c.COMPANY_NAME ?? "",
        trade_name: null,
        type: c.COMPANY_TYPE ?? "",
        state: "",
        status: c.COMPANY_STATUS ?? "",
        date_of_incorporation: convertDate(c.DATE_OF_INCORPORATION) ?? "",
        registered_office: c.REGISTERED_ADDRESS ?? "",
      })
    );

    return { companies, source: "data.gov.in" };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 429) throw new RateLimitError(tool, "data.gov.in");
      throw new DataSourceError(tool, "data.gov.in", err.message);
    }
    throw new DataSourceError(tool, "data.gov.in", String(err));
  }
}
