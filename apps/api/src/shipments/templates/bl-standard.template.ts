/**
 * Canonical Bill of Lading (documentType BL) HTML/CSS — layout aligned with house BL drafts
 * (bilingual EN/ES, charges block, Spanish terms block, agent footer).
 * Keep in sync with migration that updates `document_templates` for BL.
 * Variables: `buildTemplateContext` in document-engine.service.ts.
 */
export const BL_STANDARD_HTML = `
<div class="bl-document">
<table class="bl-grid">
  <tr>
    <td class="cell" colspan="2">
      <div class="cell-title">1. SHIPPER / EXPORTER — EXPORTADOR (NAME AND ADDRESS)</div>
      <div class="cell-body">
        <div>{{parties.shipper.name}}</div>
        <div>{{parties.shipper.address}}</div>
        <div>{{parties.shipper.contact}}</div>
        {{#if parties.shipper.rtn}}<div>RTN: {{parties.shipper.rtn}}</div>{{/if}}
      </div>
    </td>
    <td class="cell bl-doc-bl-cell" colspan="2">
      <div class="bl-doc-bl-pair">
        <div class="bl-doc-bl-col">
          <div class="cell-title">4. DOCUMENT NO. — NÚMERO DE DOCUMENTO</div>
          <div class="cell-body">{{shipment.mblNumber}}</div>
        </div>
        <div class="bl-doc-bl-col">
          <div class="cell-title">5. B/L NO. — NÚMERO DE BL</div>
          <div class="cell-body">{{#if shipment.hblNumber}}{{shipment.hblNumber}}{{else}}{{shipment.bookingNumber}}{{/if}}</div>
        </div>
      </div>
      <div class="bl-logo-wrap">
        {{#if branding.logoDataUri}}
          <img class="bl-logo" src="{{branding.logoDataUri}}" alt="Logo" />
        {{else if branding.logoUrl}}
          <img class="bl-logo" src="{{branding.logoUrl}}" alt="Logo" />
        {{else}}
          <div class="bl-logo-fallback">
            <div class="fallback-brand">{{company.shortName}}</div>
            <div class="fallback-subbrand">Logistics</div>
          </div>
        {{/if}}
      </div>
    </td>
  </tr>

  <tr>
    <td class="cell" colspan="2">
      <div class="cell-title">2. CONSIGNEE — CONSIGNATARIO</div>
      <div class="cell-body">
        <div>{{parties.consignee.name}}</div>
        <div>{{parties.consignee.address}}</div>
        <div>{{parties.consignee.contact}}</div>
        {{#if parties.consignee.rtn}}<div>RTN: {{parties.consignee.rtn}}</div>{{/if}}
      </div>
    </td>
    <td class="cell small" colspan="2">
      <div class="cell-title">6. EXPORT REFERENCES — REFERENCIAS DE EXPORTACIÓN</div>
      <div class="cell-body">{{shipment.bookingNumber}}</div>
    </td>
  </tr>

  <tr>
    <td class="cell" colspan="2">
      <div class="cell-title">3. NOTIFY PARTY — PARTE NOTIFICADA</div>
      <div class="cell-body">{{parties.notifyPartyText}}</div>
    </td>
    <td class="cell small">
      <div class="cell-title">7. CARRIER AGENT — AGENTE DE TRANSPORTE</div>
      <div class="cell-body">{{company.name}}</div>
    </td>
    <td class="cell small">
      <div class="cell-title">8. ORIGIN OF GOODS — ORIGEN DE LA MERCANCÍA</div>
      <div class="cell-body">{{transport.countryOfOriginGoods}}</div>
    </td>
  </tr>

  <tr>
    <td class="cell">
      <div class="cell-title">11. PRE-CARRIAGE — PRE-TRANSPORTE</div>
      <div class="cell-body">{{transport.preCarriageBy}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">12. PLACE OF RECEIPT — LUGAR DE RECEPCIÓN</div>
      <div class="cell-body">{{transport.placeOfReceipt}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">13. OCEAN CARRIER (VESSEL / VOY) — NAVIERA</div>
      <div class="cell-body">{{transport.vesselName}} {{transport.voyageNumber}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">14. PORT OF LOADING — PUERTO DE CARGA</div>
      <div class="cell-body">{{transport.placeOfReceipt}}</div>
    </td>
  </tr>

  <tr>
    <td class="cell" colspan="2">
      <div class="cell-title">9. FOR DELIVERY APPLY TO — PARA ENTREGA SOLICITAR A</div>
      <div class="cell-body">{{parties.consignee.name}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">10. LOADING PIER / TERMINAL — MUELLE / TERMINAL</div>
      <div class="cell-body">{{transport.loadingPierTerminal}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">15. PORT OF DISCHARGE — PUERTO DE DESCARGA</div>
      <div class="cell-body">{{#if transport.portOfDischarge}}{{transport.portOfDischarge}}{{else}}{{transport.placeOfDelivery}}{{/if}}</div>
    </td>
  </tr>

  <tr>
    <td class="cell" colspan="2">
      <div class="cell-title">16. PLACE OF DELIVERY — LUGAR DE ENTREGA</div>
      <div class="cell-body">{{transport.placeOfDelivery}}</div>
    </td>
    <td class="cell" colspan="2">
      <div class="cell-title">17. MOVEMENT TYPE — TIPO DE MOVIMIENTO</div>
      <div class="cell-body">{{shipment.movementType}} / {{shipment.incoterm}}</div>
    </td>
  </tr>
</table>

<table class="cargo-table">
  <thead>
    <tr>
      <th>18. MARKS &amp; NOS. — MARCAS Y NÚMEROS</th>
      <th>19. PKGS — NO. DE BULTOS</th>
      <th>20. DESCRIPTION — DESCRIPCIÓN</th>
      <th>21. GROSS WEIGHT — PESO BRUTO</th>
      <th>22. MEASUREMENT — MEDICIÓN</th>
    </tr>
  </thead>
  <tbody>
    {{#each cargo.containers}}
    <tr>
      <td>{{containerNumber}}{{#if sealNumber}}<br/>SEAL: {{sealNumber}}{{/if}}{{#if containerType}} ({{containerType}}){{/if}}</td>
      <td>
        {{#if packages.length}}
          {{#each packages}}
            {{#if quantity}}{{quantity}}{{/if}} {{#if type}}{{type}}{{/if}}
            {{#if dimensions}}
              ({{dimensions.length}}x{{dimensions.width}}x{{dimensions.height}}{{#if dimensions.unit}} {{dimensions.unit}}{{/if}})
            {{/if}}
            <br/>
          {{/each}}
        {{else}}
          {{../cargo.packagesQuantity}} {{../cargo.packagesType}}
        {{/if}}
      </td>
      <td>{{../cargo.goodsDescription}}</td>
      <td>{{../cargo.grossWeightKg}} KG</td>
      <td>{{../cargo.volumeCbm}} CBM</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<table class="charges-table">
  <thead>
    <tr>
      <th>FREIGHTS &amp; CHARGES — FLETES Y CARGOS</th>
      <th>RATE — TARIFA</th>
      <th>PREPAID — PAGADA</th>
      <th>COLLECT — RECOLECTAR</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>OCEAN FREIGHT — FLETE MARÍTIMO</td>
      <td></td>
      <td></td>
      <td>X</td>
    </tr>
  </tbody>
</table>

<div class="legal-text">
  <p>
    “Los detalles anteriores han sido declarados por el Expedidor, sin que el Consolidador asuma responsabilidad ni garantía alguna respecto a su exactitud (ver cláusula 3.2).
    El Consolidador recibe del Cargador, en aparente buen estado y condición (salvo que se indique lo contrario en el presente documento), el número total o la cantidad de
    contenedores, bultos u otras unidades especificadas, para su transporte o consolidación conforme a todos los términos y condiciones de este documento
    (incluyendo los términos al reverso y la tarifa aplicable del consolidador), desde el lugar de recepción o el puerto de embarque hasta el puerto de descarga o el lugar de entrega, según corresponda.”
  </p>
</div>

<table class="signature-table">
  <tr>
    <td>
      <div class="cell-title">CARRIER AGENT — AGENTE TRANSPORTISTA</div>
      <div class="cell-body">{{company.legalName}}</div>
    </td>
    <td>
      <div class="cell-title">PREPARED BY — ELABORADO POR</div>
      <div class="cell-body">{{document.preparedByName}}</div>
    </td>
    <td>
      <div class="cell-title">DATE — FECHA</div>
      <div class="cell-body">{{#if dates.etd}}{{dates.etd}}{{else}}{{now}}{{/if}}</div>
    </td>
  </tr>
</table>
</div>
`;

export const BL_STANDARD_CSS = `
body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10px; }
.bl-document { width: 100%; }
table { width: 100%; border-collapse: collapse; }
.bl-doc-bl-cell { vertical-align: top; }
.bl-doc-bl-pair {
  display: table;
  width: 100%;
  table-layout: fixed;
}
.bl-doc-bl-col {
  display: table-cell;
  width: 50%;
  vertical-align: top;
  padding-right: 8px;
}
.bl-doc-bl-col + .bl-doc-bl-col {
  padding-right: 0;
  padding-left: 8px;
  border-left: 1px solid #e0e8f0;
}
.bl-logo-wrap {
  margin-top: 10px;
  padding-top: 8px;
  text-align: center;
  border-top: 1px solid #e0e8f0;
}
.bl-logo {
  max-width: 100%;
  max-height: 104px;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}
.bl-logo-fallback {
  display: block;
  text-align: center;
  color: #222;
}
.fallback-brand { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; line-height: 1; }
.fallback-subbrand { font-size: 12px; letter-spacing: 3px; text-transform: lowercase; margin-top: 2px; }
.bl-grid { margin-bottom: 8px; }
.bl-grid td,
.cargo-table th,
.cargo-table td,
.charges-table th,
.charges-table td,
.signature-table td,
.legal-text {
  border: 1px solid #2d4f8f;
}
.cell { padding: 5px 6px; font-size: 9px; vertical-align: top; }
.cell.small { width: 22%; }
.cell-title {
  font-size: 7.5px;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 3px;
  color: #0b3d91;
  line-height: 1.25;
}
.cell-body { font-size: 9px; line-height: 1.3; white-space: pre-wrap; color: #111; }
.cargo-table { margin-top: 6px; }
.cargo-table th, .cargo-table td { padding: 5px; font-size: 8px; vertical-align: top; }
.cargo-table th {
  background: #f5f8fc;
  color: #0b3d91;
  font-size: 7.5px;
  text-transform: uppercase;
  font-weight: 700;
}
.charges-table { margin-top: 6px; }
.charges-table th, .charges-table td { padding: 5px; font-size: 8px; vertical-align: top; text-align: left; }
.charges-table th { background: #f5f8fc; color: #0b3d91; font-size: 7.5px; font-weight: 700; }
.legal-text { margin-top: 6px; padding: 6px; font-size: 7.5px; line-height: 1.35; }
.legal-text p { margin: 0; }
.signature-table { margin-top: 8px; }
.signature-table td { padding: 6px; width: 33.33%; vertical-align: top; }
`;
