import axios from "axios";
import { RateLimitError, DataSourceError } from "../errors.js";
import { logger } from "../logger.js";

const GST_API_BASE = "https://services.gst.gov.in/services/api/search";

interface GstRawResponse {
  lgnm?: string;
  tradeNam?: string;
  sts?: string;
  dty?: string;
  ctb?: string;
  rgdt?: string;
  pradr?: {
    bnm?: string;
    bno?: string;
    st?: string;
    loc?: string;
    dst?: string;
    pncd?: string;
  } | null;
  lstupdt?: string;
  nba?: string[];
  errorCode?: string;
  message?: string;
  // Filing status fields
  mbr?: Array<{
    ret_typ?: string;
    ret_prd?: string;
    dof?: string;
  }>;
}

const STATUS_MAP: Record<string, string> = {
  ACT: "Active",
  CNL: "Cancelled",
  SUS: "Suspended",
};

function convertDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function extractAddress(pradr: GstRawResponse["pradr"]) {
  if (!pradr) return null;
  const parts = [pradr.bnm, pradr.bno, pradr.st, pradr.loc, pradr.dst].filter(Boolean);
  return {
    address: parts.join(", "),
    city: pradr.loc ?? pradr.dst ?? "",
    state: null as string | null,
    pincode: pradr.pncd ?? "",
  };
}

export interface GstTaxpayerResult {
  legal_name: string;
  trade_name: string | null;
  registration_date: string;
  status: string;
  taxpayer_type: string;
  constitution: string;
  state: string;
  state_code: string;
  pan_embedded: string;
  principal_place_of_business: {
    address: string;
    city: string;
    state: string | null;
    pincode: string;
  } | null;
  filing_status: {
    last_return_type: string | null;
    last_return_period: string | null;
    last_filed_on: string | null;
  };
}

export async function fetchGstDetails(
  gstin: string,
  tool: string
): Promise<GstTaxpayerResult | null> {
  logger.debug("Fetching GST details", { gstin, tool });

  try {
    const res = await axios.get<GstRawResponse>(
      `${GST_API_BASE}/taxpayerDetails/${gstin}`,
      { timeout: 10000 }
    );

    const data = res.data;

    if (data.errorCode === "SWEB_9035") {
      return null;
    }

    if (!data.lgnm) {
      return null;
    }

    const lastFiling = data.mbr?.[0];

    return {
      legal_name: data.lgnm,
      trade_name: data.tradeNam || null,
      registration_date: convertDate(data.rgdt) ?? "",
      status: STATUS_MAP[data.sts ?? ""] ?? data.sts ?? "Unknown",
      taxpayer_type: data.dty ?? "Unknown",
      constitution: data.ctb ?? "Unknown",
      state: "",
      state_code: gstin.substring(0, 2),
      pan_embedded: gstin.substring(2, 12),
      principal_place_of_business: extractAddress(data.pradr),
      filing_status: {
        last_return_type: lastFiling?.ret_typ ?? null,
        last_return_period: lastFiling?.ret_prd ?? null,
        last_filed_on: lastFiling?.dof ? convertDate(lastFiling.dof) : null,
      },
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 404) {
        return null;
      }
      if (err.response?.status === 429) {
        logger.warn("GST API rate limited", { gstin });
        throw new RateLimitError(tool, "GST Portal");
      }
      throw new DataSourceError(tool, "GST Portal", err.message);
    }
    throw new DataSourceError(tool, "GST Portal", String(err));
  }
}

export async function fetchGstinsByPan(
  pan: string,
  tool: string
): Promise<string[]> {
  logger.debug("Fetching GSTINs by PAN", { pan });

  try {
    const res = await axios.get<Array<{ gstin: string; status: string }>>(
      `${GST_API_BASE}/taxpayerByPan/${pan}`,
      { timeout: 10000 }
    );

    if (Array.isArray(res.data)) {
      return res.data.map((r) => r.gstin);
    }
    return [];
  } catch {
    logger.warn("Failed to fetch GSTINs by PAN", { pan });
    return [];
  }
}
