import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export const buildQuotePdfFile = async (
  html: string,
  quoteNumber: string
): Promise<File> => {

  const parsed = new DOMParser().parseFromString(html, "text/html");

  const cssText = Array.from(parsed.querySelectorAll("style"))
    .map((s) => s.textContent)
    .join("\n");

  const notasEl = parsed.body.querySelector(".page-break");

  if (notasEl) notasEl.remove();

  const mainHTML = parsed.body.innerHTML;
  const notasHTML = notasEl?.outerHTML ?? "";

  const overlay = document.createElement("div");

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    background:white;
    display:flex;
    align-items:center;
    justify-content:center;
    z-index:99999;
    font-weight:bold;
    font-size:16px;
  `;

  overlay.innerText = "Generating PDF...";

  document.body.appendChild(overlay);

  const makeWrapper = (innerHTML: string) => {

    const w = document.createElement("div");

    w.style.cssText =
"position:fixed;top:-10000px;left:-10000px;width:760px;background:#fff";

    const s = document.createElement("style");
    s.textContent = cssText;

    const c = document.createElement("div");
    c.innerHTML = innerHTML;

    w.appendChild(s);
    w.appendChild(c);

    return w;
  };

  const renderCanvas = async (wrapper: HTMLElement) => {

    document.body.appendChild(wrapper);

    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );

    try {

      return await html2canvas(wrapper, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 760
      });

    } finally {
      document.body.removeChild(wrapper);
    }
  };

  const addCanvasToPdf = (
    pdf: jsPDF,
    canvas: HTMLCanvasElement,
    isFirst: boolean
  ) => {

    const margin = 10; // mm

    const pageW = pdf.internal.pageSize.getWidth() - margin * 2;

    const imgH = (canvas.height * pageW) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.98);

    if (!isFirst) pdf.addPage();

    pdf.addImage(
      imgData,
      "JPEG",
      margin,
      margin,
      pageW,
      imgH
    );
  };

  try {

    const mainCanvas = await renderCanvas(makeWrapper(mainHTML));

    const pdf = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait"
    });

    addCanvasToPdf(pdf, mainCanvas, true);

    if (notasHTML) {

      const notasCanvas = await renderCanvas(
        makeWrapper(notasHTML)
      );

      addCanvasToPdf(pdf, notasCanvas, false);
    }

    const blob = pdf.output("blob");

    return new File([blob], `Quote-${quoteNumber}.pdf`, {
      type: "application/pdf"
    });

  } finally {
    document.body.removeChild(overlay);
  }
};