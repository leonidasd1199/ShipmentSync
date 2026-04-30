/**
 * Canonical MANIFIESTO DE CARGA template aligned to operational paper format.
 * Keep in sync with migration and preview script.
 */
export const MANIFIESTO_CARGA_STANDARD_HTML = `
<div class="mc-document">
  <div class="mc-title-row">
    <div class="mc-logo-wrap">
      {{#if branding.logoDataUri}}
        <img class="mc-logo" src="{{branding.logoDataUri}}" alt="Logo" />
      {{else if branding.logoUrl}}
        <img class="mc-logo" src="{{branding.logoUrl}}" alt="Logo" />
      {{else}}
        <div class="mc-logo-fallback">
          <div class="fallback-brand">{{company.shortName}}</div>
          <div class="fallback-subbrand">Logistics</div>
        </div>
      {{/if}}
    </div>
    <div class="mc-title-block">
      <div class="mc-title">MANIFIESTO</div>
      <div class="mc-title-sub">DE CARGA</div>
      <div class="mc-code">{{#if shipment.hblNumber}}{{shipment.hblNumber}}{{else}}{{shipment.bookingNumber}}{{/if}}</div>
    </div>
  </div>

  <div class="mc-driver-line">
    <strong>PILOTO CHOFER:</strong> {{transport.driverName}}
    <span class="sep">|</span>
    <strong>LICENCIA:</strong> {{transport.driverLicense}}
    <span class="sep">|</span>
    <strong>PLACA:</strong> {{transport.truckPlate}}
  </div>

  <div class="mc-destination-grid">
    <div><strong>PAÍS DE DESTINO:</strong> {{transport.destinationCountry}}</div>
    <div><strong>ALMACÉN DESTINO:</strong> {{transport.destinationWarehouse}}</div>
  </div>

  <table class="mc-main">
    <thead>
      <tr>
        <th class="left-col">INFORMACIÓN GENERAL</th>
        <th class="qty-col">CANT.</th>
        <th class="desc-col">DESCRIPCIONES</th>
        <th class="weight-col">PESO NETO</th>
        <th class="weight-col">PESO BRUTO</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="left-col">
          <div class="block-title">SHIPPER</div>
          <div>{{parties.shipper.name}}</div>
          {{#if parties.shipper.rtn}}<div>NIT/RTN: {{parties.shipper.rtn}}</div>{{/if}}
          <div>{{parties.shipper.address}}</div>
          <div>{{parties.shipper.contact}}</div>

          <div class="block-title mt">CONSIGNATARIO</div>
          <div>{{parties.consignee.name}}</div>
          {{#if parties.consignee.rtn}}<div>NIT/RTN: {{parties.consignee.rtn}}</div>{{/if}}
          <div>{{parties.consignee.address}}</div>
          <div>{{parties.consignee.contact}}</div>

          <div class="block-title mt">NOTAS / COMENTARIOS</div>
          <div>ADUANA DE SALIDA {{transport.customsExit}}</div>
          <div>ADUANA DE INGRESO {{transport.customsEntry}}</div>
          <div>FACTURA DE EXPORTACIÓN NO. {{transport.exportInvoiceNumber}}</div>
        </td>

        <td class="qty-col">
          {{cargo.packagesQuantity}}
        </td>

        <td class="desc-col">
          <div>{{cargo.goodsDescription}}</div>
          {{#if cargo.packagesType}}<div>{{cargo.packagesType}}</div>{{/if}}
          {{#if cargo.containers.length}}
            <div class="mt">
              {{#each cargo.containers}}
                {{containerNumber}}{{#if containerType}} ({{containerType}}){{/if}}{{#if sealNumber}} / SEAL {{sealNumber}}{{/if}}<br/>
              {{/each}}
            </div>
          {{/if}}
        </td>

        <td class="weight-col">
          {{#if cargo.netWeightKg}}{{cargo.netWeightKg}} KG{{/if}}
        </td>

        <td class="weight-col">
          {{#if cargo.grossWeightKg}}{{cargo.grossWeightKg}} KG{{/if}}
        </td>
      </tr>
      <tr class="totals-row">
        <td class="left-col"><strong>TOTAL</strong></td>
        <td class="qty-col"><strong>{{cargo.packagesQuantity}}</strong></td>
        <td class="desc-col"></td>
        <td class="weight-col"><strong>{{#if cargo.netWeightKg}}{{cargo.netWeightKg}} KG{{/if}}</strong></td>
        <td class="weight-col"><strong>{{#if cargo.grossWeightKg}}{{cargo.grossWeightKg}} KG{{/if}}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="mc-footer">
    <div><strong>Fecha:</strong> {{#if transport.documentDate}}{{transport.documentDate}}{{else}}{{now}}{{/if}}</div>
    <div>{{company.legalName}}</div>
  </div>
</div>
`;

export const MANIFIESTO_CARGA_STANDARD_CSS = `
body { font-family: Arial, Helvetica, sans-serif; margin: 20px; color: #111; }
.mc-document { width: 100%; font-size: 10px; }
.mc-title-row { display: grid; grid-template-columns: 220px 1fr; align-items: end; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 8px; gap: 10px; }
.mc-title-block { min-height: 76px; }
.mc-title { font-size: 26px; font-weight: 800; letter-spacing: 1px; }
.mc-title-sub { font-size: 16px; font-weight: 700; text-transform: uppercase; }
.mc-code { font-size: 16px; font-weight: 700; margin-top: 3px; }
.mc-logo-wrap { text-align: left; padding-bottom: 4px; }
.mc-logo { max-width: 200px; max-height: 72px; width: auto; height: auto; object-fit: contain; }
.mc-logo-fallback { display: inline-block; text-align: left; color: #222; }
.fallback-brand { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; line-height: 1; }
.fallback-subbrand { font-size: 12px; letter-spacing: 3px; text-transform: lowercase; margin-top: 2px; }
.mc-driver-line { border: 1px solid #111; padding: 6px; margin-bottom: 6px; }
.mc-driver-line .sep { display: inline-block; margin: 0 8px; color: #666; }
.mc-destination-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #111; border-bottom: 0; }
.mc-destination-grid > div { padding: 6px; border-right: 1px solid #111; }
.mc-destination-grid > div:last-child { border-right: 0; }
.mc-main { width: 100%; border-collapse: collapse; table-layout: fixed; }
.mc-main th, .mc-main td { border: 1px solid #111; padding: 6px; vertical-align: top; }
.mc-main th { background: #f2f2f2; font-size: 9px; text-transform: uppercase; }
.left-col { width: 42%; }
.qty-col { width: 8%; text-align: center; }
.desc-col { width: 30%; }
.weight-col { width: 10%; text-align: right; }
.block-title { font-weight: 700; margin-bottom: 3px; text-transform: uppercase; font-size: 9px; }
.mt { margin-top: 8px; }
.totals-row td { background: #fafafa; }
.mc-footer { margin-top: 10px; border-top: 1px solid #111; padding-top: 8px; line-height: 1.4; }
`;
