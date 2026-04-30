/**
 * Renders the canonical CARTA_PORTE template with mock data and writes:
 * - storage/carta-porte-preview/carta-porte-preview.html
 * - storage/carta-porte-preview/carta-porte-preview.pdf (requires Playwright Chromium)
 *
 * Usage (from apps/api): npm run preview:carta-porte
 * Options: --html-only   skip PDF (no Playwright)
 */
import * as Handlebars from "handlebars";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  CARTA_PORTE_STANDARD_CSS,
  CARTA_PORTE_STANDARD_HTML,
} from "../shipments/templates/carta-porte-standard.template";
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
    resolve(process.cwd(), "assets/branding/carta-porte-logo.png"),
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
      hblNumber: "BK20250923",
    },
    transport: {
      cartaPorteNumber: "SS20250001",
      documentDate: "01/01/2025",
      placeOfLoading: "SAN PEDRO SULA, CORTES",
      placeOfUnloading: "SAN SALVADOR, EL SALVADOR",
      driverName: "DEMO DRIVER",
      driverLicense: "0000-000000-000-0",
      truckPlate: "P000000",
      trailerPlate: "",
      destinationCountry: "EL SALVADOR",
      destinationWarehouse: "BODEGA DESTINO",
      customsExit: "ADUANA DEMO",
      customsEntry: "ADUANA DEMO",
      exportInvoiceNumber: "INV-2025-00001",
      freightPayment: "PREPAID",
      freightAmount: "150.00 USD",
    },
    parties: {
      shipper: {
        name: "DEMO EXPORTER S. DE R.L.",
        rtn: "00000000000000",
        address: "SAN PEDRO SULA, HONDURAS",
      },
      consignee: {
        name: "DEMO IMPORTER S.A. DE C.V.",
        rtn: "00000000000000",
        address: "KM 27 1/2 CARRETERA DEMO, SAN SALVADOR, EL SALVADOR",
      },
      notifyPartyText:
        "DEMO IMPORTER S.A. DE C.V. / NIT: 00000000000000 / demo@example.com",
    },
    cargo: {
      goodsDescription: "LLENADORA DE POLVOS",
      packagesQuantity: 1,
      packagesType: "UNIDAD",
      netWeightKg: 125,
      grossWeightKg: 135,
    },
    now: "22/08/2025",
  };
}

async function main(): Promise<void> {
  const htmlOnly = process.argv.includes("--html-only");

  const context = mockContext();
  const compiled = Handlebars.compile(CARTA_PORTE_STANDARD_HTML);
  const bodyHtml = compiled(context, {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  });
  const fullHtml = buildFullHtml(bodyHtml, CARTA_PORTE_STANDARD_CSS);

  const outDir = join(process.cwd(), "storage", "carta-porte-preview");
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, "carta-porte-preview.html");
  const pdfPath = join(outDir, "carta-porte-preview.pdf");
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
      "Playwright not available. Install: npm install playwright && npx playwright install chromium\nOr run: npm run preview:carta-porte -- --html-only",
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
