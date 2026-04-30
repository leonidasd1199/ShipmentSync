/**
 * Renders the canonical HAWB template with mock data and writes:
 * - storage/hawb-preview/hawb-preview.html
 * - storage/hawb-preview/hawb-preview.pdf (requires Playwright Chromium)
 *
 * Usage (from apps/api): npm run preview:hawb
 * Options: --html-only   skip PDF (no Playwright)
 */
import * as Handlebars from "handlebars";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  HAWB_STANDARD_CSS,
  HAWB_STANDARD_HTML,
} from "../shipments/templates/hawb-standard.template";
import { readImageFileAsDataUri } from "../shipments/utils/branding.util";

function buildFullHtml(bodyHtml: string, css: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function mockContext(): Record<string, unknown> {
  const logoCandidates = [
    resolve(process.cwd(), "assets/branding/hawb-logo.png"),
    resolve(process.cwd(), "assets/branding/logo.png"),
  ];
  const selectedLogo = logoCandidates.find((logoPath) => existsSync(logoPath));
  const logoDataUri = selectedLogo
    ? readImageFileAsDataUri(selectedLogo)
    : null;

  return {
    company: {
      shortName: "SHIPSYNC",
      legalName: "SHIPSYNC LOGISTICS S. DE R.L.",
    },
    branding: {
      logoDataUri,
      logoUrl: null,
    },
    shipment: {
      bookingNumber: "BK20250923",
      hblNumber: "810-40467770",
    },
    parties: {
      shipper: {
        name: "DEMO MACHINERY INC.",
        address: "100 INDUSTRIAL BLVD, DALLAS, UNITED STATES",
        contact: "contact@demo-machinery.com / +1 555 000 0001",
      },
      consignee: {
        name: "DEMO TEXTILES S. DE R.L.",
        address: "PARQUE IND DEMO, CHOLOMA, CORTES, HONDURAS",
        contact: "RTN: 00000000000000",
      },
    },
    cargo: {
      goodsDescription: "INDUSTRIAL EQUIPMENT / EQUIPOS INDUSTRIALES",
      packagesQuantity: 1,
      packagesType: "CRATE",
      grossWeightKg: 500,
      airDimensionsText: "1@100X50X50(IN)",
    },
    transport: {
      hawbNumber: "0000 0001",
      airlinePrefix: "000",
      airportOfDepartureCode: "MIA",
      fileNumber: "SS-AE250001",
      shipperAccountNumber: "",
      consigneeAccountNumber: "",
      issuingCarrierAgent: "DEMO FREIGHT AGENCY, MIAMI FLORIDA 33100, UNITED STATES",
      agentIataCode: "",
      agentAccountNumber: "",
      airportOfDeparture: "(MIA) MIAMI INT'L",
      toAirportCode: "SAP",
      firstCarrier: "DEMO AIRLINE INC.",
      airportOfDestination: "(SAP) RAMON VILLEDA MORALES INT'L",
      requestedFlight: "XX 0001 / XX 0002",
      requestedFlightDate: "01-01-2025",
      currency: "USD",
      chargesCode: "PP",
      declaredValueCarriage: "NVD",
      declaredValueCustoms: "NCV",
      insuranceAmount: "XXX",
      handlingInformation: "Demo shipment for preview purposes only.",
      ratePerKg: "2.00 USD",
      totalCharge: "1,000.00 USD",
      totalPrepaid: "1,000.00 USD",
      totalCollect: "0.00 USD",
      chargesAtDestination: "",
      totalCollectCharges: "SS-AH2500001",
      executedDate: "01-01-2025",
      executedPlace: "SAN PEDRO SULA",
    },
    now: "12-08-2025",
  };
}

async function main(): Promise<void> {
  const htmlOnly = process.argv.includes("--html-only");

  const context = mockContext();
  const compiled = Handlebars.compile(HAWB_STANDARD_HTML);
  const bodyHtml = compiled(context, {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  });
  const fullHtml = buildFullHtml(bodyHtml, HAWB_STANDARD_CSS);

  const outDir = join(process.cwd(), "storage", "hawb-preview");
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, "hawb-preview.html");
  const pdfPath = join(outDir, "hawb-preview.pdf");
  writeFileSync(htmlPath, fullHtml, "utf8");
  console.log(`Wrote ${htmlPath}`);

  if (htmlOnly) {
    console.log("Skipping PDF (--html-only). Open the HTML file in a browser.");
    return;
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    console.error(
      "Playwright not available. Install: npm install playwright && npx playwright install chromium\nOr run: npm run preview:hawb -- --html-only",
    );
    process.exit(1);
  }

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
    writeFileSync(pdfPath, pdfBuffer);
    console.log(`Wrote ${pdfPath}`);
  } finally {
    await browser.close();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
