/**
 * Renders the seeded MANIFIESTO_CARGA template with mock data and writes:
 * - storage/manifiesto-carga-preview/manifiesto-carga-preview.html
 * - storage/manifiesto-carga-preview/manifiesto-carga-preview.pdf (requires Playwright Chromium)
 *
 * Usage (from apps/api): npm run preview:manifiesto
 * Options: --html-only   skip PDF (no Playwright)
 */
import * as Handlebars from "handlebars";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  MANIFIESTO_CARGA_STANDARD_CSS,
  MANIFIESTO_CARGA_STANDARD_HTML,
} from "../shipments/templates/manifiesto-carga-standard.template";
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
    resolve(process.cwd(), "assets/branding/manifiesto-logo.png"),
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
      manifestNumber: "SS20250001",
      documentDate: "Lunes, 01 enero 2025",
      driverName: "DEMO DRIVER",
      driverLicense: "0000-000000-000-0",
      truckPlate: "P000000",
      trailerPlate: "TR-0000",
      placeOfLoading: "BODEGA ORIGEN",
      placeOfUnloading: "BODEGA DESTINO",
      destinationCountry: "EL SALVADOR",
      destinationWarehouse: "BODEGA DESTINO",
      customsExit: "ADUANA DEMO",
      customsEntry: "ADUANA DEMO",
      exportInvoiceNumber: "INV-2025-00001",
    },
    parties: {
      shipper: {
        name: "DEMO SHIPPER S.A. DE C.V.",
        rtn: "00000000000000",
        address: "CALLE DEMO, SAN SALVADOR, EL SALVADOR",
      },
      consignee: {
        name: "DEMO CONSIGNEE",
      },
    },
    cargo: {
      goodsDescription: "LLENADORA DE POLVOS",
      packagesQuantity: 1,
      packagesType: "UNIDAD",
      netWeightKg: 125,
      grossWeightKg: 135,
      containers: [],
    },
    now: "Viernes, 22 agosto 2025",
  };
}

async function main(): Promise<void> {
  const htmlOnly = process.argv.includes("--html-only");

  const context = mockContext();
  const compiled = Handlebars.compile(MANIFIESTO_CARGA_STANDARD_HTML);
  const bodyHtml = compiled(context, {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  });
  const fullHtml = buildFullHtml(bodyHtml, MANIFIESTO_CARGA_STANDARD_CSS);

  const outDir = join(process.cwd(), "storage", "manifiesto-carga-preview");
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, "manifiesto-carga-preview.html");
  const pdfPath = join(outDir, "manifiesto-carga-preview.pdf");
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
      "Playwright not available. Install: npm install playwright && npx playwright install chromium\nOr run: npm run preview:manifiesto -- --html-only",
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
