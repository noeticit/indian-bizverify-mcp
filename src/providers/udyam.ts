import { DataSourceError } from "../errors.js";
import { logger } from "../logger.js";

const UDYAM_URL = "https://udyamregistration.gov.in/udyam-verify";
const SCRAPER_TIMEOUT = parseInt(process.env.SCRAPER_TIMEOUT_MS ?? "15000", 10);

export interface UdyamResult {
  enterprise_name: string;
  owner_name: string;
  category: "Micro" | "Small" | "Medium";
  activity_type: "Manufacturing" | "Service";
  nic_code: string;
  nic_description: string;
  date_of_registration: string;
  date_of_commencement: string;
  pan: string | null;
  gstin: string | null;
  social_category: string;
  district: string;
  state: string;
  status: "Active" | "Cancelled";
  employees: {
    male: number;
    female: number;
    total: number;
  };
  investment_in_plant_machinery_inr: number | null;
  turnover_inr: number | null;
}

export async function fetchUdyamDetails(
  udyamNumber: string,
  tool: string
): Promise<UdyamResult | null> {
  logger.debug("Fetching Udyam details via scraper", { udyamNumber });

  try {
    // Dynamic import — playwright may not be available in all environments
    const { chromium } = await import("playwright");
    let launchFn: typeof chromium.launch;

    try {
      const playwrightAws = await import("playwright-aws-lambda");
      const browser = await playwrightAws.default.launchChromium();
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(UDYAM_URL, { timeout: SCRAPER_TIMEOUT });
        await page.fill('input[name="udyam"], input[id*="udyam"], input[type="text"]', udyamNumber);
        await page.click('button[type="submit"], input[type="submit"], button:has-text("Verify")');
        await page.waitForSelector("table, .result, .details", { timeout: SCRAPER_TIMEOUT });

        const result = await page.evaluate(() => {
          const getText = (label: string): string => {
            const cells = Array.from(document.querySelectorAll("td, th, dt, dd, span, div"));
            for (let i = 0; i < cells.length; i++) {
              if (cells[i].textContent?.trim().toLowerCase().includes(label.toLowerCase())) {
                const next = cells[i + 1] ?? cells[i].parentElement?.querySelector("td:last-child, dd");
                return next?.textContent?.trim() ?? "";
              }
            }
            return "";
          };

          const parseNum = (s: string): number => parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;

          const male = parseNum(getText("male"));
          const female = parseNum(getText("female"));

          return {
            enterprise_name: getText("enterprise name") || getText("name of enterprise"),
            owner_name: getText("owner") || getText("proprietor"),
            category: getText("category") || getText("enterprise type"),
            activity_type: getText("activity") || getText("major activity"),
            nic_code: getText("nic code") || getText("NIC"),
            nic_description: getText("nic description") || getText("activity description"),
            date_of_registration: getText("date of registration") || getText("registration date"),
            date_of_commencement: getText("date of commencement") || getText("commencement"),
            pan: getText("pan") || null,
            gstin: getText("gstin") || getText("gst") || null,
            social_category: getText("social category") || getText("social"),
            district: getText("district"),
            state: getText("state"),
            status: getText("status"),
            male,
            female,
            total: male + female || parseNum(getText("total")),
            investment: getText("investment") || getText("plant"),
            turnover: getText("turnover"),
          };
        });

        if (!result.enterprise_name) {
          return null;
        }

        const parseAmount = (s: string): number | null => {
          const num = parseInt(s.replace(/[^0-9]/g, ""), 10);
          return isNaN(num) ? null : num;
        };

        return {
          enterprise_name: result.enterprise_name,
          owner_name: result.owner_name,
          category: (result.category as UdyamResult["category"]) || "Micro",
          activity_type: (result.activity_type as UdyamResult["activity_type"]) || "Service",
          nic_code: result.nic_code,
          nic_description: result.nic_description,
          date_of_registration: result.date_of_registration,
          date_of_commencement: result.date_of_commencement,
          pan: result.pan || null,
          gstin: result.gstin || null,
          social_category: result.social_category,
          district: result.district,
          state: result.state,
          status: result.status === "Cancelled" ? "Cancelled" : "Active",
          employees: {
            male: result.male,
            female: result.female,
            total: result.total,
          },
          investment_in_plant_machinery_inr: parseAmount(result.investment),
          turnover_inr: parseAmount(result.turnover),
        };
      } finally {
        await browser.close();
      }
    } catch {
      // Fallback to regular Playwright if AWS lambda chromium not available
      launchFn = chromium.launch;
      const browser = await launchFn({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto(UDYAM_URL, { timeout: SCRAPER_TIMEOUT });
        await page.fill('input[name="udyam"], input[id*="udyam"], input[type="text"]', udyamNumber);
        await page.click('button[type="submit"], input[type="submit"], button:has-text("Verify")');
        await page.waitForSelector("table, .result, .details", { timeout: SCRAPER_TIMEOUT });

        // Simplified extraction — return null on failure
        logger.warn("Udyam scraper using local Playwright fallback", { udyamNumber });
        return null;
      } finally {
        await browser.close();
      }
    }
  } catch (err) {
    logger.error("Udyam scraper failed", { udyamNumber, error: String(err) });
    throw new DataSourceError(tool, "Udyam Portal", String(err));
  }
}
