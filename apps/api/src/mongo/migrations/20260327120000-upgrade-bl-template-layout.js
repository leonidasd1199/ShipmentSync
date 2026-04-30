/**
 * Updates all Bill of Lading (BL) document_templates to the grid layout (bl-title / bl-grid).
 * Source of truth for HTML/CSS: `src/shipments/templates/bl-standard.template.ts` — keep in sync.
 */
const BL_STANDARD_HTML = `
<div class="bl-title">BILL OF LADING</div>

<table class="bl-grid">
  <tr>
    <td class="cell" colspan="2">
      <div class="cell-title">1. SHIPPER / EXPORTER</div>
      <div class="cell-body">
        <div>{{parties.shipper.name}}</div>
        <div>{{parties.shipper.address}}</div>
        <div>{{parties.shipper.contact}}</div>
        {{#if parties.shipper.rtn}}<div>RTN: {{parties.shipper.rtn}}</div>{{/if}}
      </div>
    </td>
    <td class="cell small">
      <div class="cell-title">4. DOCUMENT REF.</div>
      <div class="cell-body">{{shipment.quotationId}}</div>
    </td>
    <td class="cell small">
      <div class="cell-title">5. B/L NO.</div>
      <div class="cell-body">{{#if shipment.hblNumber}}{{shipment.hblNumber}}{{else}}{{shipment.mblNumber}}{{/if}}</div>
    </td>
  </tr>

  <tr>
    <td class="cell" colspan="2">
      <div class="cell-title">2. CONSIGNEE</div>
      <div class="cell-body">
        <div>{{parties.consignee.name}}</div>
        <div>{{parties.consignee.address}}</div>
        <div>{{parties.consignee.contact}}</div>
        {{#if parties.consignee.rtn}}<div>RTN: {{parties.consignee.rtn}}</div>{{/if}}
      </div>
    </td>
    <td class="cell small" colspan="2">
      <div class="cell-title">6. EXPORT REFERENCES / BOOKING</div>
      <div class="cell-body">{{shipment.bookingNumber}}</div>
    </td>
  </tr>

  <tr>
    <td class="cell" colspan="2">
      <div class="cell-title">3. NOTIFY PARTY</div>
      <div class="cell-body">{{parties.notifyPartyText}}</div>
    </td>
    <td class="cell small">
      <div class="cell-title">7. CARRIER</div>
      <div class="cell-body">{{company.name}}</div>
    </td>
    <td class="cell small">
      <div class="cell-title">8. MOVEMENT / INCOTERM</div>
      <div class="cell-body">{{shipment.movementType}} / {{shipment.incoterm}}</div>
    </td>
  </tr>

  <tr>
    <td class="cell">
      <div class="cell-title">11. PRE-CARRIAGE / VESSEL</div>
      <div class="cell-body">{{transport.vesselName}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">12. PLACE OF RECEIPT</div>
      <div class="cell-body">{{transport.placeOfReceipt}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">13. VOYAGE</div>
      <div class="cell-body">{{transport.voyageNumber}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">14. PORT OF LOADING</div>
      <div class="cell-body">{{transport.placeOfReceipt}}</div>
    </td>
  </tr>

  <tr>
    <td class="cell" colspan="2">
      <div class="cell-title">9. FOR DELIVERY (CONSIGNEE)</div>
      <div class="cell-body">{{parties.consignee.name}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">15. PORT OF DISCHARGE</div>
      <div class="cell-body">{{transport.placeOfDelivery}}</div>
    </td>
    <td class="cell">
      <div class="cell-title">16. PLACE OF DELIVERY</div>
      <div class="cell-body">{{transport.placeOfDelivery}}</div>
    </td>
  </tr>
</table>

<table class="cargo-table">
  <thead>
    <tr>
      <th>18. MARKS / CONTAINER</th>
      <th>19. PKGS</th>
      <th>20. DESCRIPTION</th>
      <th>21. GROSS WEIGHT (KG)</th>
      <th>22. MEASURE (CBM)</th>
    </tr>
  </thead>
  <tbody>
    {{#each cargo.containers}}
    <tr>
      <td>{{containerNumber}}{{#if sealNumber}} / Seal {{sealNumber}}{{/if}}{{#if containerType}} ({{containerType}}){{/if}}</td>
      <td>{{../cargo.packagesQuantity}} {{../cargo.packagesType}}</td>
      <td>{{../cargo.goodsDescription}}</td>
      <td>{{../cargo.grossWeightKg}}</td>
      <td>{{../cargo.volumeCbm}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>

<div class="legal-text">
  <p>
    The above particulars are as declared by the shipper. Carriage is subject to the terms and conditions of this Bill of Lading.
  </p>
</div>

<table class="signature-table">
  <tr>
    <td>
      <div class="cell-title">CARRIER</div>
      <div class="cell-body">{{company.name}}</div>
    </td>
    <td>
      <div class="cell-title">DATE</div>
      <div class="cell-body">{{#if dates.etd}}{{dates.etd}}{{else}}{{now}}{{/if}}</div>
    </td>
  </tr>
</table>
`;

const BL_STANDARD_CSS = `
.bl-title { text-align: center; font-size: 20px; font-weight: 700; letter-spacing: 1px; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; }
.bl-grid { margin-bottom: 10px; }
.bl-grid td { border: 1px solid #333; vertical-align: top; }
.cell { padding: 6px; font-size: 10px; }
.cell.small { width: 24%; }
.cell-title { font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
.cell-body { font-size: 10px; line-height: 1.35; white-space: pre-wrap; }
.cargo-table { margin-top: 8px; }
.cargo-table th, .cargo-table td { border: 1px solid #333; padding: 6px; font-size: 10px; vertical-align: top; }
.cargo-table th { background: #efefef; font-size: 9px; text-transform: uppercase; }
.legal-text { margin-top: 8px; border: 1px solid #333; padding: 7px; font-size: 9px; line-height: 1.35; }
.legal-text p { margin: 0; }
.signature-table { margin-top: 8px; }
.signature-table td { border: 1px solid #333; padding: 6px; width: 50%; vertical-align: top; }
`;

module.exports = {
  async up(db) {
    const collection = db.collection("document_templates");
    const result = await collection.updateMany(
      { documentType: "BL" },
      {
        $set: {
          html: BL_STANDARD_HTML.trim(),
          css: BL_STANDARD_CSS.trim(),
          updatedAt: new Date(),
        },
        $inc: { templateVersion: 1 },
      },
    );
    console.log(
      `✅ BL template layout upgrade: matched ${result.matchedCount}, modified ${result.modifiedCount}`,
    );
  },

  async down() {
    console.warn(
      "⚠️  20260327120000-upgrade-bl-template-layout: no automatic down — restore BL templates from backup or re-seed.",
    );
  },
};
