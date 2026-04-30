/**
 * Migration: Add missing document templates
 * Adds templates for MBL, HBL, COMMERCIAL_INVOICE, PACKING_LIST, DEBIT_PDF, CREDIT_PDF
 */
module.exports = {
  async up(db) {
    const collection = db.collection("document_templates");

    const user = await db.collection("users").findOne({ roleCode: "ops_admin" });
    if (!user) {
      console.log("⚠️  No ops_admin user found. Skipping template seeding.");
      return;
    }
    const adminUserId = user._id.toString();

    const templates = [
      // ── OCEAN: Master Bill of Lading ────────────────────────────────────────
      {
        mode: "OCEAN",
        documentType: "MBL",
        html: `
<div class="document-header">
  <h1>MASTER BILL OF LADING</h1>
  <div class="header-info">
    <div><strong>MBL Number:</strong> {{shipment.mblNumber}}</div>
    <div><strong>Booking Number:</strong> {{shipment.bookingNumber}}</div>
    <div><strong>Date:</strong> {{#if dates.etd}}{{dates.etd}}{{else}}{{now}}{{/if}}</div>
  </div>
</div>

<div class="parties-section">
  <div class="party-block">
    <h3>SHIPPER</h3>
    <div>{{parties.shipper.name}}</div>
    <div>{{parties.shipper.address}}</div>
    <div>{{parties.shipper.contact}}</div>
    {{#if parties.shipper.rtn}}<div>RTN: {{parties.shipper.rtn}}</div>{{/if}}
  </div>
  <div class="party-block">
    <h3>CONSIGNEE</h3>
    <div>{{parties.consignee.name}}</div>
    <div>{{parties.consignee.address}}</div>
    <div>{{parties.consignee.contact}}</div>
    {{#if parties.consignee.rtn}}<div>RTN: {{parties.consignee.rtn}}</div>{{/if}}
  </div>
</div>
{{#if parties.notifyPartyText}}
<div class="notify-section">
  <h3>NOTIFY PARTY</h3>
  <p>{{parties.notifyPartyText}}</p>
</div>
{{/if}}

<div class="transport-section">
  <h3>VESSEL &amp; VOYAGE</h3>
  <table>
    <tr><td>Vessel Name:</td><td>{{transport.vesselName}}</td></tr>
    <tr><td>Voyage Number:</td><td>{{transport.voyageNumber}}</td></tr>
    <tr><td>Place of Receipt:</td><td>{{transport.placeOfReceipt}}</td></tr>
    <tr><td>Place of Delivery:</td><td>{{transport.placeOfDelivery}}</td></tr>
    <tr><td>ETD:</td><td>{{dates.etd}}</td></tr>
    <tr><td>ETA:</td><td>{{dates.eta}}</td></tr>
  </table>
</div>

<div class="cargo-section">
  <h3>CARGO DETAILS</h3>
  <table>
    <thead>
      <tr><th>Container</th><th>Seal</th><th>Type</th><th>Description</th><th>Weight (kg)</th></tr>
    </thead>
    <tbody>
      {{#each cargo.containers}}
      <tr>
        <td>{{containerNumber}}</td>
        <td>{{sealNumber}}</td>
        <td>{{containerType}}</td>
        <td>{{../cargo.goodsDescription}}</td>
        <td>{{../cargo.grossWeightKg}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div>Packages: {{cargo.packagesQuantity}} {{cargo.packagesType}}</div>
    <div>Gross Weight: {{cargo.grossWeightKg}} kg</div>
    <div>Volume: {{cargo.volumeCbm}} CBM</div>
  </div>
</div>

<div class="footer">
  <p><strong>Incoterm:</strong> {{shipment.incoterm}}</p>
  <p><strong>Movement Type:</strong> {{shipment.movementType}}</p>
  <p class="issued">Issued as MASTER BILL OF LADING</p>
</div>`,
        css: `body{font-family:Arial,sans-serif;margin:20px;font-size:13px}.document-header{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}.document-header h1{margin:0 0 10px;font-size:20px;text-align:center}.header-info{display:flex;justify-content:space-between;margin-top:8px}.parties-section{display:flex;gap:20px;margin:20px 0}.party-block{flex:1;border:1px solid #ccc;padding:10px}.party-block h3{margin-top:0;background:#f0f0f0;padding:5px;font-size:12px}.notify-section{border:1px solid #ccc;padding:10px;margin:10px 0}.transport-section,.cargo-section{margin:20px 0}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0;font-size:11px}.totals{margin-top:8px;font-weight:bold;font-size:12px}.footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px}.issued{font-style:italic;color:#555}`,
      },

      // ── OCEAN: House Bill of Lading ──────────────────────────────────────────
      {
        mode: "OCEAN",
        documentType: "HBL",
        html: `
<div class="document-header">
  <h1>HOUSE BILL OF LADING</h1>
  <div class="header-info">
    <div><strong>HBL Number:</strong> {{shipment.hblNumber}}</div>
    <div><strong>MBL Number:</strong> {{shipment.mblNumber}}</div>
    <div><strong>Date:</strong> {{#if dates.etd}}{{dates.etd}}{{else}}{{now}}{{/if}}</div>
  </div>
</div>

<div class="parties-section">
  <div class="party-block">
    <h3>SHIPPER / EXPORTER</h3>
    <div>{{parties.shipper.name}}</div>
    <div>{{parties.shipper.address}}</div>
    <div>{{parties.shipper.contact}}</div>
    {{#if parties.shipper.rtn}}<div>RTN: {{parties.shipper.rtn}}</div>{{/if}}
  </div>
  <div class="party-block">
    <h3>CONSIGNEE / IMPORTER</h3>
    <div>{{parties.consignee.name}}</div>
    <div>{{parties.consignee.address}}</div>
    <div>{{parties.consignee.contact}}</div>
    {{#if parties.consignee.rtn}}<div>RTN: {{parties.consignee.rtn}}</div>{{/if}}
  </div>
</div>
{{#if parties.notifyPartyText}}
<div class="notify-section">
  <h3>NOTIFY PARTY</h3>
  <p>{{parties.notifyPartyText}}</p>
</div>
{{/if}}

<div class="transport-section">
  <h3>VESSEL &amp; VOYAGE</h3>
  <table>
    <tr><td>Vessel Name:</td><td>{{transport.vesselName}}</td></tr>
    <tr><td>Voyage Number:</td><td>{{transport.voyageNumber}}</td></tr>
    <tr><td>Port of Loading:</td><td>{{transport.placeOfReceipt}}</td></tr>
    <tr><td>Port of Discharge:</td><td>{{transport.placeOfDelivery}}</td></tr>
    <tr><td>ETD:</td><td>{{dates.etd}}</td></tr>
    <tr><td>ETA:</td><td>{{dates.eta}}</td></tr>
  </table>
</div>

<div class="cargo-section">
  <h3>CARGO DETAILS</h3>
  <table>
    <thead>
      <tr><th>Container</th><th>Seal</th><th>Type</th><th>Description</th><th>Weight (kg)</th></tr>
    </thead>
    <tbody>
      {{#each cargo.containers}}
      <tr>
        <td>{{containerNumber}}</td>
        <td>{{sealNumber}}</td>
        <td>{{containerType}}</td>
        <td>{{../cargo.goodsDescription}}</td>
        <td>{{../cargo.grossWeightKg}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="totals">
    <div>Packages: {{cargo.packagesQuantity}} {{cargo.packagesType}}</div>
    <div>Gross Weight: {{cargo.grossWeightKg}} kg</div>
    <div>Volume: {{cargo.volumeCbm}} CBM</div>
  </div>
</div>

<div class="footer">
  <p><strong>Incoterm:</strong> {{shipment.incoterm}}</p>
  <p><strong>Movement Type:</strong> {{shipment.movementType}}</p>
  <p class="issued">Issued as HOUSE BILL OF LADING</p>
</div>`,
        css: `body{font-family:Arial,sans-serif;margin:20px;font-size:13px}.document-header{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}.document-header h1{margin:0 0 10px;font-size:20px;text-align:center}.header-info{display:flex;justify-content:space-between;margin-top:8px}.parties-section{display:flex;gap:20px;margin:20px 0}.party-block{flex:1;border:1px solid #ccc;padding:10px}.party-block h3{margin-top:0;background:#f0f0f0;padding:5px;font-size:12px}.notify-section{border:1px solid #ccc;padding:10px;margin:10px 0}.transport-section,.cargo-section{margin:20px 0}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0;font-size:11px}.totals{margin-top:8px;font-weight:bold;font-size:12px}.footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px}.issued{font-style:italic;color:#555}`,
      },

      // ── COMMERCIAL INVOICE (mode=OCEAN; engine will fallback to any mode) ────
      {
        mode: "OCEAN",
        documentType: "COMMERCIAL_INVOICE",
        html: `
<div class="document-header">
  <h1>COMMERCIAL INVOICE</h1>
  <div class="header-info">
    <div><strong>Invoice Date:</strong> {{now}}</div>
    <div><strong>Ref / HBL:</strong> {{shipment.hblNumber}}</div>
    <div><strong>Booking No:</strong> {{shipment.bookingNumber}}</div>
  </div>
</div>

<div class="parties-section">
  <div class="party-block">
    <h3>SELLER / EXPORTER</h3>
    <div>{{parties.shipper.name}}</div>
    <div>{{parties.shipper.address}}</div>
    <div>{{parties.shipper.contact}}</div>
    {{#if parties.shipper.rtn}}<div>RTN: {{parties.shipper.rtn}}</div>{{/if}}
  </div>
  <div class="party-block">
    <h3>BUYER / IMPORTER</h3>
    <div>{{parties.consignee.name}}</div>
    <div>{{parties.consignee.address}}</div>
    <div>{{parties.consignee.contact}}</div>
    {{#if parties.consignee.rtn}}<div>RTN: {{parties.consignee.rtn}}</div>{{/if}}
  </div>
</div>

<div class="shipment-section">
  <h3>SHIPMENT DETAILS</h3>
  <table>
    <tr><td>Mode:</td><td>{{shipment.mode}}</td></tr>
    <tr><td>Incoterm:</td><td>{{shipment.incoterm}}</td></tr>
    <tr><td>Port of Origin:</td><td>{{transport.placeOfReceipt}}</td></tr>
    <tr><td>Port of Destination:</td><td>{{transport.placeOfDelivery}}</td></tr>
    <tr><td>ETD:</td><td>{{dates.etd}}</td></tr>
    <tr><td>ETA:</td><td>{{dates.eta}}</td></tr>
  </table>
</div>

<div class="cargo-section">
  <h3>DESCRIPTION OF GOODS</h3>
  <table>
    <thead>
      <tr><th>Description</th><th>Qty</th><th>Unit</th><th>Gross Weight (kg)</th><th>Volume (CBM)</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>{{cargo.goodsDescription}}</td>
        <td>{{cargo.packagesQuantity}}</td>
        <td>{{cargo.packagesType}}</td>
        <td>{{cargo.grossWeightKg}}</td>
        <td>{{cargo.volumeCbm}}</td>
      </tr>
    </tbody>
  </table>

  {{#if cargo.containers.length}}
  <h3>CONTAINERS</h3>
  <table>
    <thead>
      <tr><th>Container No.</th><th>Seal No.</th><th>Type</th></tr>
    </thead>
    <tbody>
      {{#each cargo.containers}}
      <tr>
        <td>{{containerNumber}}</td>
        <td>{{sealNumber}}</td>
        <td>{{containerType}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{/if}}
</div>

<div class="footer">
  <p>I/We hereby certify that the information in this Commercial Invoice is true and correct.</p>
  <div class="signature-block">
    <div>Authorized Signature: ________________________</div>
    <div>Date: {{now}}</div>
  </div>
</div>`,
        css: `body{font-family:Arial,sans-serif;margin:20px;font-size:13px}.document-header{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}.document-header h1{margin:0 0 10px;font-size:20px;text-align:center}.header-info{display:flex;justify-content:space-between;margin-top:8px}.parties-section{display:flex;gap:20px;margin:20px 0}.party-block{flex:1;border:1px solid #ccc;padding:10px}.party-block h3{margin-top:0;background:#f0f0f0;padding:5px;font-size:12px}.shipment-section,.cargo-section{margin:20px 0}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0;font-size:11px}.footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px}.signature-block{margin-top:40px;display:flex;justify-content:space-between}`,
      },

      // ── PACKING LIST ─────────────────────────────────────────────────────────
      {
        mode: "OCEAN",
        documentType: "PACKING_LIST",
        html: `
<div class="document-header">
  <h1>PACKING LIST</h1>
  <div class="header-info">
    <div><strong>Date:</strong> {{now}}</div>
    <div><strong>Ref / HBL:</strong> {{shipment.hblNumber}}</div>
    <div><strong>Booking No:</strong> {{shipment.bookingNumber}}</div>
  </div>
</div>

<div class="parties-section">
  <div class="party-block">
    <h3>SHIPPER / EXPORTER</h3>
    <div>{{parties.shipper.name}}</div>
    <div>{{parties.shipper.address}}</div>
    <div>{{parties.shipper.contact}}</div>
  </div>
  <div class="party-block">
    <h3>CONSIGNEE / IMPORTER</h3>
    <div>{{parties.consignee.name}}</div>
    <div>{{parties.consignee.address}}</div>
    <div>{{parties.consignee.contact}}</div>
  </div>
</div>

<div class="shipment-section">
  <h3>SHIPMENT DETAILS</h3>
  <table>
    <tr><td>Mode:</td><td>{{shipment.mode}}</td></tr>
    <tr><td>Incoterm:</td><td>{{shipment.incoterm}}</td></tr>
    <tr><td>Origin:</td><td>{{transport.placeOfReceipt}}</td></tr>
    <tr><td>Destination:</td><td>{{transport.placeOfDelivery}}</td></tr>
    <tr><td>ETD:</td><td>{{dates.etd}}</td></tr>
    <tr><td>ETA:</td><td>{{dates.eta}}</td></tr>
  </table>
</div>

<div class="cargo-section">
  <h3>PACKING DETAILS</h3>
  <table>
    <thead>
      <tr><th>#</th><th>Description</th><th>Packages</th><th>Type</th><th>Gross Weight (kg)</th><th>Volume (CBM)</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>{{cargo.goodsDescription}}</td>
        <td>{{cargo.packagesQuantity}}</td>
        <td>{{cargo.packagesType}}</td>
        <td>{{cargo.grossWeightKg}}</td>
        <td>{{cargo.volumeCbm}}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2"><strong>TOTAL</strong></td>
        <td><strong>{{cargo.packagesQuantity}}</strong></td>
        <td>{{cargo.packagesType}}</td>
        <td><strong>{{cargo.grossWeightKg}} kg</strong></td>
        <td><strong>{{cargo.volumeCbm}} CBM</strong></td>
      </tr>
    </tfoot>
  </table>

  {{#if cargo.containers.length}}
  <h3>CONTAINER SUMMARY</h3>
  <table>
    <thead>
      <tr><th>Container No.</th><th>Seal No.</th><th>Type</th></tr>
    </thead>
    <tbody>
      {{#each cargo.containers}}
      <tr>
        <td>{{containerNumber}}</td>
        <td>{{sealNumber}}</td>
        <td>{{containerType}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  {{/if}}
</div>

<div class="footer">
  <div class="signature-block">
    <div>Authorized Signature: ________________________</div>
    <div>Date: {{now}}</div>
  </div>
</div>`,
        css: `body{font-family:Arial,sans-serif;margin:20px;font-size:13px}.document-header{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}.document-header h1{margin:0 0 10px;font-size:20px;text-align:center}.header-info{display:flex;justify-content:space-between;margin-top:8px}.parties-section{display:flex;gap:20px;margin:20px 0}.party-block{flex:1;border:1px solid #ccc;padding:10px}.party-block h3{margin-top:0;background:#f0f0f0;padding:5px;font-size:12px}.shipment-section,.cargo-section{margin:20px 0}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0;font-size:11px}.total-row{background:#f9f9f9;font-weight:bold}.footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px}.signature-block{margin-top:40px;display:flex;justify-content:space-between}`,
      },

      // ── DEBIT NOTE ───────────────────────────────────────────────────────────
      {
        mode: "OCEAN",
        documentType: "DEBIT_PDF",
        html: `
<div class="document-header">
  <h1>DEBIT NOTE</h1>
  <div class="header-info">
    <div><strong>Date:</strong> {{now}}</div>
    <div><strong>Ref / HBL:</strong> {{shipment.hblNumber}}</div>
    <div><strong>Booking No:</strong> {{shipment.bookingNumber}}</div>
  </div>
</div>

<div class="parties-section">
  <div class="party-block">
    <h3>FROM (Freight Forwarder)</h3>
    <p><em>Your Company Name</em></p>
  </div>
  <div class="party-block">
    <h3>TO (CLIENT)</h3>
    <div>{{parties.consignee.name}}</div>
    <div>{{parties.consignee.address}}</div>
    {{#if parties.consignee.rtn}}<div>RTN: {{parties.consignee.rtn}}</div>{{/if}}
  </div>
</div>

<div class="shipment-ref">
  <h3>SHIPMENT REFERENCE</h3>
  <table>
    <tr><td>Mode:</td><td>{{shipment.mode}}</td></tr>
    <tr><td>Incoterm:</td><td>{{shipment.incoterm}}</td></tr>
    <tr><td>Origin:</td><td>{{transport.placeOfReceipt}}</td></tr>
    <tr><td>Destination:</td><td>{{transport.placeOfDelivery}}</td></tr>
    <tr><td>Shipper:</td><td>{{parties.shipper.name}}</td></tr>
    <tr><td>Consignee:</td><td>{{parties.consignee.name}}</td></tr>
  </table>
</div>

{{#if ledger}}
<div class="charges-section">
  <h3>CHARGES (DEBIT)</h3>
  <table>
    <thead>
      <tr><th>Description</th><th>Amount</th><th>Currency</th><th>Status</th></tr>
    </thead>
    <tbody>
      {{#each ledger.debits}}
      <tr>
        <td>{{description}}</td>
        <td>{{amount}}</td>
        <td>{{currency}}</td>
        <td>{{status}}</td>
      </tr>
      {{/each}}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2"><strong>TOTAL DEBIT</strong></td>
        <td><strong>{{ledger.totalDebits}} {{ledger.currency}}</strong></td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</div>
{{else}}
<div class="charges-section">
  <p><em>No ledger data available. Please add debit entries in the Finance tab.</em></p>
</div>
{{/if}}

<div class="footer">
  <p>Please process payment within 15 days of receipt of this debit note.</p>
  <div class="signature-block">
    <div>Authorized Signature: ________________________</div>
    <div>Date: {{now}}</div>
  </div>
</div>`,
        css: `body{font-family:Arial,sans-serif;margin:20px;font-size:13px}.document-header{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}.document-header h1{margin:0 0 10px;font-size:20px;text-align:center;color:#c0392b}.header-info{display:flex;justify-content:space-between;margin-top:8px}.parties-section{display:flex;gap:20px;margin:20px 0}.party-block{flex:1;border:1px solid #ccc;padding:10px}.party-block h3{margin-top:0;background:#f0f0f0;padding:5px;font-size:12px}.shipment-ref,.charges-section{margin:20px 0}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0;font-size:11px}.total-row{background:#fdecea;font-weight:bold}.footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px}.signature-block{margin-top:40px;display:flex;justify-content:space-between}`,
      },

      // ── CREDIT NOTE ──────────────────────────────────────────────────────────
      {
        mode: "OCEAN",
        documentType: "CREDIT_PDF",
        html: `
<div class="document-header">
  <h1>CREDIT NOTE</h1>
  <div class="header-info">
    <div><strong>Date:</strong> {{now}}</div>
    <div><strong>Ref / HBL:</strong> {{shipment.hblNumber}}</div>
    <div><strong>Booking No:</strong> {{shipment.bookingNumber}}</div>
  </div>
</div>

<div class="parties-section">
  <div class="party-block">
    <h3>FROM (Freight Forwarder)</h3>
    <p><em>Your Company Name</em></p>
  </div>
  <div class="party-block">
    <h3>TO (CLIENT)</h3>
    <div>{{parties.consignee.name}}</div>
    <div>{{parties.consignee.address}}</div>
    {{#if parties.consignee.rtn}}<div>RTN: {{parties.consignee.rtn}}</div>{{/if}}
  </div>
</div>

<div class="shipment-ref">
  <h3>SHIPMENT REFERENCE</h3>
  <table>
    <tr><td>Mode:</td><td>{{shipment.mode}}</td></tr>
    <tr><td>Incoterm:</td><td>{{shipment.incoterm}}</td></tr>
    <tr><td>Origin:</td><td>{{transport.placeOfReceipt}}</td></tr>
    <tr><td>Destination:</td><td>{{transport.placeOfDelivery}}</td></tr>
    <tr><td>Shipper:</td><td>{{parties.shipper.name}}</td></tr>
    <tr><td>Consignee:</td><td>{{parties.consignee.name}}</td></tr>
  </table>
</div>

{{#if ledger}}
<div class="charges-section">
  <h3>CREDITS</h3>
  <table>
    <thead>
      <tr><th>Description</th><th>Amount</th><th>Currency</th><th>Status</th></tr>
    </thead>
    <tbody>
      {{#each ledger.credits}}
      <tr>
        <td>{{description}}</td>
        <td>{{amount}}</td>
        <td>{{currency}}</td>
        <td>{{status}}</td>
      </tr>
      {{/each}}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2"><strong>TOTAL CREDIT</strong></td>
        <td><strong>{{ledger.totalCredits}} {{ledger.currency}}</strong></td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</div>
{{else}}
<div class="charges-section">
  <p><em>No ledger data available. Please add credit entries in the Finance tab.</em></p>
</div>
{{/if}}

<div class="footer">
  <p>This credit note will be applied to your account as indicated above.</p>
  <div class="signature-block">
    <div>Authorized Signature: ________________________</div>
    <div>Date: {{now}}</div>
  </div>
</div>`,
        css: `body{font-family:Arial,sans-serif;margin:20px;font-size:13px}.document-header{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}.document-header h1{margin:0 0 10px;font-size:20px;text-align:center;color:#27ae60}.header-info{display:flex;justify-content:space-between;margin-top:8px}.parties-section{display:flex;gap:20px;margin:20px 0}.party-block{flex:1;border:1px solid #ccc;padding:10px}.party-block h3{margin-top:0;background:#f0f0f0;padding:5px;font-size:12px}.shipment-ref,.charges-section{margin:20px 0}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f0f0f0;font-size:11px}.total-row{background:#eafaf1;font-weight:bold}.footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px}.signature-block{margin-top:40px;display:flex;justify-content:space-between}`,
      },
    ];

    for (const template of templates) {
      const existing = await collection.findOne({
        mode: template.mode,
        documentType: template.documentType,
        isActive: true,
      });

      if (!existing) {
        await collection.insertOne({
          mode: template.mode,
          documentType: template.documentType,
          templateVersion: 1,
          html: template.html.trim(),
          css: template.css.trim(),
          isActive: true,
          createdBy: adminUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`✅ Seeded template: ${template.mode} - ${template.documentType}`);
      } else {
        console.log(`ℹ️  Template already exists: ${template.mode} - ${template.documentType}`);
      }
    }

    console.log("✅ Missing document templates migration completed");
  },

  async down(db) {
    await db.collection("document_templates").deleteMany({
      mode: "OCEAN",
      documentType: {
        $in: ["MBL", "HBL", "COMMERCIAL_INVOICE", "PACKING_LIST", "DEBIT_PDF", "CREDIT_PDF"],
      },
    });
    console.log("❌ Missing document templates removed");
  },
};
