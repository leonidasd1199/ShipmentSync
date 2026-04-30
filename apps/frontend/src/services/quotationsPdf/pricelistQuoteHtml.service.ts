/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    calcWithProfit,
    calcTotalSellingPrice,
    getOptionLabel,
    formatDisplayDate
} from "./../../utils/quotation.helper";

export const buildPricelistQuoteHTML = (quotation: any): string => {

    const { quoteDetails, shippingLines } = quotation;

    const chargeRows = [
        { key: "oceanFreight", label: "Ocean Freight" },
        { key: "destinationCharges", label: "Destination Charges" },
        { key: "originHandlingFees", label: "Origin Handling Fees" },
        { key: "docFee", label: "Doc Fee per BL" },
        { key: "inlandFreight", label: "Inland Freight" },
    ] as const;

    const shippingLinesHTML = shippingLines.map((sl: any, idx: number) => {

        const optLabel = getOptionLabel(idx);
        const displayName = sl.supplierName || sl.name;

        const usesPricelistItems =
            sl.isFromPricelist &&
            sl.routes.some((r: any) => r.pricelistItems?.length);

        let rowsHTML = "";

        if (usesPricelistItems) {

            // Collect unique labels in order of first appearance across all routes
            const seenLabels = new Set<string>();
            const uniqueLabels: string[] = [];
            for (const route of sl.routes) {
                for (const item of (route.pricelistItems ?? [])) {
                    if (!seenLabels.has(item.label)) {
                        seenLabels.add(item.label);
                        uniqueLabels.push(item.label);
                    }
                }
            }

            rowsHTML = uniqueLabels.map((label, rowIdx) => `
<tr style="${rowIdx % 2 === 0 ? "" : "background:#F9FAFB;"}">
<td>${label}</td>
${sl.routes.map((r: any) => {

                const routeItem = r.pricelistItems?.find((i: any) => i.label === label);

                if (!routeItem) return `<td>—</td>`;

                const withProfit = calcWithProfit(routeItem.cost, routeItem.profit);

                return `<td>USD ${withProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>`;

            }).join("")}
</tr>
`).join("");

        } else {

            rowsHTML = chargeRows.map(({ key, label }, rowIdx) => `
<tr style="${rowIdx % 2 === 0 ? "" : "background:#F9FAFB;"}">
<td>${label}</td>
${sl.routes.map((r: any) => {

                const base = r[key];
                const profit = r.profits[key] || {
                    type: "percentage",
                    value: 0
                };

                const withProfit = calcWithProfit(base, profit);

                return `<td>USD ${withProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>`;

            }).join("")}
</tr>
`).join("");
        }

        return `
<div class="shipping-line">

<div class="sl-header">
<span class="sl-name">OPTION ${optLabel} — ${displayName}</span>
<span class="sl-info">${sl.transitTime} | ${sl.freeDays} FREE</span>
</div>

<table class="rates-table">

<thead>
<tr>

<th class="desc-col">DESCRIPTION</th>

${sl.routes.map((r: any) => `
<th>
<div style="font-size:9px;color:#666;font-weight:normal;">Port of Origin</div>
<div>${r.pol || "—"}</div>

<div style="font-size:9px;color:#666;font-weight:normal;margin-top:2px;">Port of Landing</div>
<div style="font-weight:normal;font-size:10px;">${r.pod || "—"}</div>
</th>
`).join("")}

</tr>
</thead>

<tbody>

${rowsHTML}

<tr class="rate-all-in">
<td>RATE ALL IN</td>

${sl.routes.map((r: any) => {

            const sellingPrice = calcTotalSellingPrice(r);

            return `<td>USD ${sellingPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>`;

        }).join("")}

</tr>

</tbody>

</table>
</div>
`;

    }).join("");

    return `
<!DOCTYPE html>
<html>

<head>

<meta charset="UTF-8">

<title>Quote ${quoteDetails.quoteNumber}</title>

<style>

*{margin:0;padding:0;box-sizing:border-box;}

body{
font-family:Arial,Helvetica,sans-serif;
font-size:11px;
padding:15px;
color:#1a1a1a;
background:#fff;
}

.header{
display:flex;
justify-content:space-between;
align-items:flex-start;
margin-bottom:15px;
border-bottom:3px solid #1E3A5F;
padding-bottom:10px;
}

.title{
color:#1E3A5F;
font-size:32px;
font-weight:bold;
letter-spacing:2px;
}

.company-info{
color:#666;
margin-top:5px;
font-size:10px;
line-height:1.4;
}

.quote-info{
text-align:right;
}

.quote-info table{
margin-left:auto;
border-collapse:collapse;
}

.quote-info td{
padding:3px 8px;
font-size:10px;
}

.quote-info .label{
font-weight:bold;
color:#1E3A5F;
text-align:right;
}

.quote-info .value{
background:#F3F4F6;
padding:3px 10px;
}

.details-row{
display:flex;
gap:15px;
margin-bottom:15px;
}

.details-box,.client-box{
flex:1;
border:1px solid #ddd;
border-radius:4px;
overflow:hidden;
}

.box-header{
background:#1E3A5F;
color:#fff;
padding:6px 10px;
font-weight:bold;
font-size:10px;
}

.box-content{
padding:10px;
background:#fff;
}

.box-content table{
width:100%;
font-size:10px;
}

.box-content td{
padding:2px 0;
}

.box-content .label{
font-weight:bold;
color:#555;
width:120px;
}

.shipping-line{
margin-bottom:15px;
page-break-inside:avoid;
}

.sl-header{
background:#1E3A5F;
color:#fff;
padding:8px 12px;
display:flex;
justify-content:space-between;
align-items:center;
border-radius:4px 4px 0 0;
}

.sl-name{
font-size:14px;
font-weight:bold;
}

.sl-info{
font-size:10px;
opacity:0.9;
}

.rates-table{
width:100%;
border-collapse:collapse;
border:1px solid #ddd;
border-top:none;
background:#fff;
}

.rates-table th,
.rates-table td{
border:1px solid #ddd;
padding:6px 8px;
text-align:center;
font-size:10px;
}

.rates-table th{
background:#F3F4F6;
font-weight:600;
color:#1E3A5F;
}

.desc-col{
text-align:left!important;
width:140px;
background:#F9FAFB!important;
}

.rates-table td:first-child{
text-align:left;
background:#F9FAFB;
font-weight:500;
}

.rate-all-in{
background:#FEF9C3!important;
}

.rate-all-in td{
font-weight:bold!important;
color:#92400E!important;
background:#FEF9C3!important;
}

.page-break{
page-break-before:always;
}

.notas-header{
display:flex;
justify-content:space-between;
align-items:center;
margin-bottom:20px;
border-bottom:3px solid #1E3A5F;
padding-bottom:10px;
}

.notas-title{
font-size:28px;
font-weight:bold;
color:#1E3A5F;
text-align:center;
flex:1;
}

.notas-content{
font-size:10px;
line-height:1.6;
}

.notas-content p{
margin-bottom:6px;
}

</style>

</head>

<body>

<div class="header">

<div>

<div class="title">QUOTATION</div>

<div class="company-info">

<strong>Nuevos Horizontes, Business Center, Rancho el Coco</strong><br/>
San Pedro Sula, Cortes, Honduras<br/>
Website: grandeslogistics.com<br/>
Phone: +504 3199-3659<br/>

${quoteDetails.salesExecutive ? `Sales Executive: ${quoteDetails.salesExecutive}` : ""}

</div>

</div>

<div class="quote-info">

<table>

<tr>
<td class="label">QUOTE #</td>
<td class="value">${quoteDetails.quoteNumber}</td>
</tr>

<tr>
<td class="label">DATE</td>
<td class="value">${formatDisplayDate(quoteDetails.date)}</td>
</tr>

<tr>
<td class="label">VALID FROM</td>
<td class="value">${formatDisplayDate(quoteDetails.validFrom)}</td>
</tr>

<tr>
<td class="label">VALID UNTIL</td>
<td class="value">${formatDisplayDate(quoteDetails.validUntil)}</td>
</tr>

</table>

</div>

</div>

<div class="details-row">

<div class="details-box">

<div class="box-header">DETAILS</div>

<div class="box-content">

<table>

<tr>
<td class="label">ORIGIN</td>
<td>${quoteDetails.origin}</td>
</tr>

<tr>
<td class="label">DESTINATION</td>
<td>${quoteDetails.destination}</td>
</tr>

<tr>
<td class="label">INCOTERM</td>
<td>${quoteDetails.incoterm}</td>
</tr>

<tr>
<td class="label">EQUIPMENT</td>
<td>${quoteDetails.equipment}</td>
</tr>

<tr>
<td class="label">COMMODITY</td>
<td>${quoteDetails.commodity}</td>
</tr>

</table>

</div>

</div>

<div class="client-box">

<div class="box-header">CLIENT</div>

<div class="box-content">

<p style="font-size:14px;font-weight:bold;">
${quoteDetails.clientName || "—"}
</p>

</div>

</div>

</div>

${shippingLinesHTML}

<!-- NOTAS -->
 <div class="page-break notas-page">
    <div class="notas-header">
      <div style="font-size: 14px; font-weight: bold; color: #1E3A5F;">SHIPSYNC<br/><span style="font-size: 8px; font-weight: normal;">logistics</span></div>
      <div class="notas-title">NOTAS IMPORTANTES</div>
    </div>
    <div class="footer-section" style="margin-top: 0; margin-bottom: 15px;">
      <p class="bold">LA TARIFA INCLUYE:</p>
      <p>1. HONORARIOS ADUANEROS</p>
      <p>2. FLETE MARITIMO</p>
      <p>3. CARGOS LOCALES EN DESTINO.</p>
      <p class="italic" style="margin-top: 6px;"><em>PESO MAXIMO PERMITIDO POR LA IHTT POR TAMAÑO DE CONTENEDOR:</em></p>
      <p><strong>NETO PERMITIDO | 20STD: 23,143.00 KG</strong></p>
      <p><strong>NETO PERMITIDO 2 EJES | 40HQ: 21,620.91 KG</strong></p>
      <p><strong>NETO PERMITIDO 3 EJES | 20STD/40HQ: 25,410.91 KG</strong></p>
    </div>
    <div class="notas-content">
      <p>1. Tarifa cotizada según información brindada, en caso de que el origen y destino final sean diferente, la tarifa cambiaría.</p>
      <p>2. NO incluye, impuestos arancelarios Origen / Destino, almacenajes ni otros gastos no especificados en la oferta.</p>
      <p>3. Tarifas detalladas en USD</p>
      <p>4. Las cargas no aseguradas viajan por cuenta y riesgos del cliente. En caso de requerir el servicio de seguro favor considerar nuestra póliza de seguro con una tasa de 0.80% sobre el valor asegurable, con un mínimo de $80.00.</p>
      <p>5. Cotizaciones están sujetas a cualquier cambio sin aviso previo.</p>
      <br/>
      <p>*Tarifas sujetas a disponibilidad de espacio y contenedores, sujeto a aprobación en el momento de realizar la reserva.</p>
      <p>*Tarifa no incluye pago de impuestos.</p>
      <p>*No incluye tramites de permisos especiales, cuarentenas, lic</p>
      <p>*Las tarifas detalladas NO son aplicables para manejo de mercancías peligrosas, animales vivos, o artículos de alto valor.</p>
      <p>Las tarifas en esta cotización son en base a medidas y peso estimadas y sujetas a la verificación por parte de la naviera.</p>
      <p>* La tarifa NO incluye cargos portuarios inspecciones, impuestos, transitos, almacenajes, sobreestadías, costo de carga y descarga.</p>
      <p>* Tarifas sujetas a variación sin previo aviso.</p>
      <p>*Tiempos de transito estimado y sujetos a cambios por parte de la naviera</p>
      <br/>
      <p class="nota-bold">*TARIFA SUJETA A CONFIRMACION DE ESPACIO &amp; EQUIPO</p>
      <p>*Tarifa NO incluye impresión de BL en origen.</p>
      <p>*Tarifa NO incluye cargos de importación por parte de ENP, almacenajes ni otros costos no especificados en la oferta.</p>
      <p>Cargos por sobrepeso no incluidos.</p>
      <p>Si es otro tipo de carga el cliente es responsable de informar a <strong>Transporte Grandes</strong>. para aplicar el correspondiente ajuste.</p>
      <p>*Los costos por almacenaje en destino u origen corren por cuenta del cliente.</p>
      <p class="nota-italic-bold">*Tarifa NO incluye trámite aduanero de exportación ni de importación.</p>
      <p>Tarifa NO incluye cargos locales de la naviera en origen.</p>
      <p class="nota-italic-bold">Tarifa NO incluye TELEX</p>
      <div class="important-notice">
        <p><strong>TRANSPORTE GRANDES</strong> remarca a sus clientes la importancia de tomar seguro de mercadería sobre TODAS las operaciones. Esto debido a las limitaciones de responsabilidad legales aplicables en la materia y por las convenciones internacionales, tanto por parte de aerolíneas, líneas marítimas, empresas de camiones y demás agentes involucrados. Se deja constancia que la presente cotización no incluye seguro de mercadería. Por tanto, no se validarán reclamos sin la cobertura de seguros apropiada.</p>
      </div>
      <p class="demoras">****Demoras y ocupaciones, si las hubiera, no incluidas. Cualquier otro gasto extra (Inspecciones aduaneras, tramites de sanidad o farmacia, entrega o manejo especial, etc...) no incluidos</p>
    </div>
  </div>
</body>
</html>
`;
};
