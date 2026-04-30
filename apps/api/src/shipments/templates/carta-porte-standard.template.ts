/**
 * Canonical CARTA PORTE template aligned to operational paper format.
 * Keep in sync with migration and preview script.
 */
export const CARTA_PORTE_STANDARD_HTML = `
<div class="cp-document">
  <div class="cp-header">
    <div class="cp-logo-wrap">
      {{#if branding.logoDataUri}}
        <img class="cp-logo" src="{{branding.logoDataUri}}" alt="Logo" />
      {{else if branding.logoUrl}}
        <img class="cp-logo" src="{{branding.logoUrl}}" alt="Logo" />
      {{else}}
        <div class="cp-logo-fallback">
          <div class="fallback-brand">{{company.shortName}}</div>
          <div class="fallback-subbrand">Logistics</div>
        </div>
      {{/if}}
    </div>
    <div class="cp-title-block">
      <div class="cp-title">CARTA PORTE</div>
      <div class="cp-number"><strong>No.</strong> {{#if transport.cartaPorteNumber}}{{transport.cartaPorteNumber}}{{else}}{{shipment.bookingNumber}}{{/if}}</div>
      <div class="cp-date"><strong>FECHA:</strong> {{#if transport.documentDate}}{{transport.documentDate}}{{else}}{{now}}{{/if}}</div>
    </div>
  </div>

  <table class="cp-parties">
    <tr>
      <td>
        <div class="section-title">EXPORTADOR / REMITENTE</div>
        <div>{{parties.shipper.name}}</div>
        {{#if parties.shipper.rtn}}<div>RTN/NIT: {{parties.shipper.rtn}}</div>{{/if}}
        <div>{{parties.shipper.address}}</div>
      </td>
      <td>
        <div class="section-title">IMPORTADOR / CONSIGNATARIO</div>
        <div>{{parties.consignee.name}}</div>
        {{#if parties.consignee.rtn}}<div>RTN/NIT: {{parties.consignee.rtn}}</div>{{/if}}
        <div>{{parties.consignee.address}}</div>
      </td>
      <td>
        <div class="section-title">NOTIFICAR A</div>
        <div>{{parties.notifyPartyText}}</div>
      </td>
    </tr>
  </table>

  <table class="cp-locations">
    <tr>
      <td><strong>LUGAR DE CARGA:</strong> {{transport.placeOfLoading}}</td>
      <td><strong>LUGAR DE DESCARGA:</strong> {{transport.placeOfUnloading}}</td>
    </tr>
  </table>

  <table class="cp-driver">
    <tr>
      <td><strong>NOMBRE DEL PILOTO / CHOFER:</strong> {{transport.driverName}}</td>
      <td><strong>LICENCIA:</strong> {{transport.driverLicense}}</td>
    </tr>
    <tr>
      <td><strong>PLACA DEL CABEZAL / CAMIÓN:</strong> {{transport.truckPlate}}</td>
      <td><strong>PLACA DEL REMOLQUE:</strong> {{transport.trailerPlate}}</td>
    </tr>
    <tr>
      <td colspan="2"><strong>AGENTE DE ENTREGA:</strong> {{company.legalName}}</td>
    </tr>
  </table>

  <div class="cp-notes">
    <div class="section-title">NOTAS / COMENTARIOS</div>
    <div>ADUANA DE SALIDA {{transport.customsExit}} - ADUANA DE INGRESO {{transport.customsEntry}}</div>
    <div>FACTURA DE EXPORTACIÓN NO. {{transport.exportInvoiceNumber}}</div>
  </div>

  <table class="cp-cargo">
    <thead>
      <tr>
        <th class="qty-col">CANTIDAD DE BULTOS</th>
        <th class="desc-col">DESCRIPCIÓN DE LA MERCANCÍA (DICE CONTENER)</th>
        <th class="weight-col">PESO NETO</th>
        <th class="weight-col">PESO BRUTO</th>
        <th class="freight-col">FLETE</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="qty-col">{{cargo.packagesQuantity}}</td>
        <td class="desc-col">
          <div>{{cargo.goodsDescription}}</div>
          {{#if cargo.packagesType}}<div>{{cargo.packagesType}}</div>{{/if}}
        </td>
        <td class="weight-col">{{#if cargo.netWeightKg}}{{cargo.netWeightKg}} kg{{/if}}</td>
        <td class="weight-col">{{#if cargo.grossWeightKg}}{{cargo.grossWeightKg}} kg{{/if}}</td>
        <td class="freight-col">{{#if transport.freightAmount}}{{transport.freightAmount}}{{else}}-{{/if}}</td>
      </tr>
    </tbody>
  </table>

  <div class="cp-freight">FLETE: {{#if transport.freightPayment}}{{transport.freightPayment}}{{else}}PREPAID{{/if}}</div>

  <div class="cp-signature-grid">
    <div class="cp-sign-box">
      <div class="section-title">FIRMA Y SELLO DEL REMITENTE</div>
    </div>
    <div class="cp-sign-box cp-disclaimer">
      EL REMITENTE CERTIFICA QUE LA INFORMACIÓN CONTENIDA EN ESTA CARTA DE PORTE ES CORRECTA Y VERDADERA, APRUEBA Y ACEPTA LAS CONDICIONES DEL FLETE ESCRITAS.
    </div>
  </div>
</div>
`;

export const CARTA_PORTE_STANDARD_CSS = `
body { font-family: Arial, Helvetica, sans-serif; margin: 20px; color: #111; }
.cp-document { width: 100%; font-size: 10px; }
.cp-header { display: grid; grid-template-columns: 220px 1fr; align-items: end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8px; gap: 10px; }
.cp-logo-wrap { text-align: left; }
.cp-logo { max-width: 200px; max-height: 72px; width: auto; height: auto; object-fit: contain; }
.cp-logo-fallback { display: inline-block; text-align: left; color: #222; }
.fallback-brand { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; line-height: 1; }
.fallback-subbrand { font-size: 12px; letter-spacing: 3px; text-transform: lowercase; margin-top: 2px; }
.cp-title-block { min-height: 72px; }
.cp-title { font-size: 24px; font-weight: 800; letter-spacing: 1px; }
.cp-number, .cp-date { font-size: 12px; margin-top: 2px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 6px; }
td, th { border: 1px solid #111; padding: 6px; vertical-align: top; }
th { background: #f2f2f2; text-transform: uppercase; font-size: 9px; }
.cp-parties td { width: 33.33%; }
.section-title { font-weight: 700; text-transform: uppercase; font-size: 9px; margin-bottom: 3px; }
.cp-notes { border: 1px solid #111; padding: 6px; margin-top: 6px; }
.cp-cargo .qty-col { width: 14%; text-align: center; }
.cp-cargo .desc-col { width: 48%; }
.cp-cargo .weight-col { width: 14%; text-align: right; }
.cp-cargo .freight-col { width: 10%; text-align: right; }
.cp-freight { border: 1px solid #111; border-top: 0; padding: 6px; font-weight: 700; }
.cp-signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
.cp-sign-box { border: 1px solid #111; min-height: 80px; padding: 6px; }
.cp-disclaimer { font-size: 9px; line-height: 1.4; text-transform: uppercase; }
`;
