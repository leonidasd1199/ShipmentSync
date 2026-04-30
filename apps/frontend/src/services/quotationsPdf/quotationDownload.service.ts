/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildQuotationHTML } from "./quotationHtml.service";
import { buildQuotePdfFile } from "./quotePdf.service";

export const downloadQuotationPDF = async (quotation: any) => {

  const html = buildQuotationHTML(quotation);

  const pdfFile = await buildQuotePdfFile(
    html,
    quotation.quoteDetails.quoteNumber
  );

  const url = URL.createObjectURL(pdfFile);

  const a = document.createElement("a");

  a.href = url;
  a.download = pdfFile.name;

  a.click();

  URL.revokeObjectURL(url);
};