/**
 * Renders the canonical BL template with mock data and writes:
 * - storage/bl-preview/bl-preview.html (open in browser)
 * - storage/bl-preview/bl-preview.pdf (requires Playwright Chromium)
 *
 * Usage (from apps/api): npm run preview:bl
 * Options: --html-only   skip PDF (no Playwright)
 */
import * as Handlebars from "handlebars";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import {
  BL_STANDARD_CSS,
  BL_STANDARD_HTML,
} from "../shipments/templates/bl-standard.template";
import { readImageFileAsDataUri } from "../shipments/utils/branding.util";

const companyHeader = `<div style="text-align:center;padding:10px 0 12px;border-bottom:3px solid #000;margin-bottom:18px;"><span style="font-family:Arial,sans-serif;font-size:22px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">SHIPSYNC LOGISTICS</span></div>`;

function buildFullHtml(bodyHtml: string, css: string): string {
  const omitOuter =
    bodyHtml.includes("bl-document") || bodyHtml.includes("bl-header");
  const bodyInner = omitOuter ? bodyHtml : `${companyHeader}${bodyHtml}`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body>
  ${bodyInner}
</body>
</html>`;
}

function mockBlContext(): Record<string, unknown> {
  const defaultLogo = resolve(process.cwd(), "assets/branding/logo.png");
  const logoDataUri = existsSync(defaultLogo)
    ? readImageFileAsDataUri(defaultLogo)
    : null;

  return {
    company: {
      name: "SHIPSYNC LOGISTICS",
      legalName: "SHIPSYNC LOGISTICS S. DE R.L.",
      shortName: "SHIPSYNC",
    },
    document: {
      preparedByName: "Preview User",
    },
    branding: {
      logoDataUri,
      logoUrl: null,
    },
    shipment: {
      quotationId: "507f1f77bcf86cd799439011",
      bookingNumber: "BK36799",
      mblNumber: "MEDUW7236799",
      hblNumber: "BK36799",
      movementType: "FCL/FCL",
      incoterm: "FOB",
    },
    parties: {
      shipper: {
        name: "Acme Export Co.",
        address: "123 Industrial Blvd, San Pedro Sula, HN",
        contact: "shipper@example.com",
        rtn: "0801-1990-12345",
      },
      consignee: {
        name: "Global Imports LLC",
        address: "456 Harbor Way, Los Angeles, CA 90001, USA",
        contact: "imports@example.com",
        rtn: "",
      },
      notifyPartyText: "Same as consignee",
    },
    cargo: {
      containers: [
        {
          containerNumber: "MSKU1234567",
          sealNumber: "SL889900",
          containerType: "40HC",
        },
      ],
      packagesQuantity: 120,
      packagesType: "CARTONS",
      goodsDescription: "Electronic components — HS 8542",
      grossWeightKg: 18500,
      volumeCbm: 67.2,
    },
    transport: {
      vesselName: "HONGLUNJI3026",
      voyageNumber: "V.2601E",
      preCarriageBy: "CHONGQING CHINA",
      placeOfReceipt: "SHANGHAI, CHINA",
      portOfDischarge: "PUERTO CORTES, HONDURAS",
      placeOfDelivery: "SAN PEDRO SULA, HONDURAS",
      loadingPierTerminal: "",
      countryOfOriginGoods: "CHINA",
    },
    dates: {
      etd: "28 Mar 2026",
    },
    now: "28 Mar 2026",
  };
}

async function main(): Promise<void> {
  const htmlOnly = process.argv.includes("--html-only");
  const context = mockBlContext();
  const compiled = Handlebars.compile(BL_STANDARD_HTML);
  const bodyHtml = compiled(context, {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  });
  const fullHtml = buildFullHtml(bodyHtml, BL_STANDARD_CSS);

  const outDir = join(process.cwd(), "storage", "bl-preview");
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, "bl-preview.html");
  const pdfPath = join(outDir, "bl-preview.pdf");
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
      "Playwright not available. Install: npm install playwright && npx playwright install chromium\nOr run: npm run preview:bl -- --html-only",
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
