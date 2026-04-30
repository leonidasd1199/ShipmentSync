// Import seed templates - using require with path resolution
const path = require("path");
const fs = require("fs");

// Read seed templates file
const seedTemplatesPath = path.join(
  __dirname,
  "../../shipments/helpers/seed-templates.ts",
);

// For migration, we'll define templates inline since TS files can't be directly required
const seedTemplates = [
  {
    mode: "OCEAN",
    documentType: "BL",
    html: `
<div class="document-header">
  <h1>BILL OF LADING</h1>
  <div class="header-info">
    <div><strong>Booking Number:</strong> {{shipment.bookingNumber}}</div>
    <div><strong>BL Number:</strong> {{shipment.hblNumber}}</div>
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

<div class="transport-section">
  <h3>TRANSPORT DETAILS</h3>
  <table>
    <tr><td>Vessel:</td><td>{{transport.vesselName}}</td></tr>
    <tr><td>Voyage:</td><td>{{transport.voyageNumber}}</td></tr>
    <tr><td>Port of Loading:</td><td>{{transport.placeOfReceipt}}</td></tr>
    <tr><td>Port of Discharge:</td><td>{{transport.placeOfDelivery}}</td></tr>
  </table>
</div>

<div class="cargo-section">
  <h3>CARGO DETAILS</h3>
  <table>
    <thead>
      <tr>
        <th>Container</th>
        <th>Seal</th>
        <th>Type</th>
        <th>Description</th>
        <th>Weight (kg)</th>
      </tr>
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
    <div>Total Packages: {{cargo.packagesQuantity}} {{cargo.packagesType}}</div>
    <div>Total Weight: {{cargo.grossWeightKg}} kg</div>
    <div>Total Volume: {{cargo.volumeCbm}} CBM</div>
  </div>
</div>

<div class="footer">
  <p><strong>Incoterm:</strong> {{shipment.incoterm}}</p>
  <p><strong>Movement Type:</strong> {{shipment.movementType}}</p>
</div>
`,
    css: `
body { font-family: Arial, sans-serif; margin: 20px; }
.document-header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
.header-info { display: flex; justify-content: space-between; margin-top: 10px; }
.parties-section { display: flex; gap: 20px; margin: 20px 0; }
.party-block { flex: 1; border: 1px solid #ccc; padding: 10px; }
.party-block h3 { margin-top: 0; background: #f0f0f0; padding: 5px; }
.transport-section, .cargo-section { margin: 20px 0; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; }
th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
th { background: #f0f0f0; }
.totals { margin-top: 10px; font-weight: bold; }
.footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; }
`,
  },
  {
    mode: "LAND",
    documentType: "CARTA_PORTE",
    html: `
<div class="document-header">
  <h1>CARTA PORTE</h1>
  <div class="header-info">
    <div><strong>Carta Porte Number:</strong> {{transport.cartaPorteNumber}}</div>
    <div><strong>Date:</strong> {{transport.documentDate}}</div>
  </div>
</div>

<div class="parties-section">
  <div class="party-block">
    <h3>REMITENTE (Shipper)</h3>
    <div>{{parties.shipper.name}}</div>
    <div>{{parties.shipper.address}}</div>
    <div>{{parties.shipper.contact}}</div>
  </div>
  
  <div class="party-block">
    <h3>DESTINATARIO (Consignee)</h3>
    <div>{{parties.consignee.name}}</div>
    <div>{{parties.consignee.address}}</div>
    <div>{{parties.consignee.contact}}</div>
  </div>
</div>

<div class="transport-section">
  <h3>TRANSPORTE</h3>
  <table>
    <tr><td>Lugar de Carga:</td><td>{{transport.placeOfLoading}}</td></tr>
    <tr><td>Lugar de Descarga:</td><td>{{transport.placeOfUnloading}}</td></tr>
    <tr><td>Conductor:</td><td>{{transport.driverName}}</td></tr>
    <tr><td>Licencia:</td><td>{{transport.driverLicense}}</td></tr>
    <tr><td>Placa Tracto:</td><td>{{transport.truckPlate}}</td></tr>
    <tr><td>Placa Remolque:</td><td>{{transport.trailerPlate}}</td></tr>
    <tr><td>País Destino:</td><td>{{transport.destinationCountry}}</td></tr>
    <tr><td>Almacén Destino:</td><td>{{transport.destinationWarehouse}}</td></tr>
  </table>
</div>

<div class="cargo-section">
  <h3>MERCANCÍA</h3>
  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Cantidad</th>
        <th>Tipo</th>
        <th>Peso Bruto (kg)</th>
        <th>Peso Neto (kg)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{{cargo.goodsDescription}}</td>
        <td>{{cargo.packagesQuantity}}</td>
        <td>{{cargo.packagesType}}</td>
        <td>{{cargo.grossWeightKg}}</td>
        <td>{{cargo.netWeightKg}}</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="customs-section">
  <h3>ADUANA</h3>
  <table>
    <tr><td>Salida Aduana:</td><td>{{transport.customsExit}}</td></tr>
    <tr><td>Entrada Aduana:</td><td>{{transport.customsEntry}}</td></tr>
    <tr><td>Factura Exportación:</td><td>{{transport.exportInvoiceNumber}}</td></tr>
  </table>
</div>

<div class="footer">
  <p><strong>Forma de Pago Flete:</strong> {{transport.freightPayment}}</p>
</div>
`,
    css: `
body { font-family: Arial, sans-serif; margin: 20px; }
.document-header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
.header-info { display: flex; justify-content: space-between; margin-top: 10px; }
.parties-section { display: flex; gap: 20px; margin: 20px 0; }
.party-block { flex: 1; border: 1px solid #ccc; padding: 10px; }
.party-block h3 { margin-top: 0; background: #f0f0f0; padding: 5px; }
.transport-section, .cargo-section, .customs-section { margin: 20px 0; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; }
th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
th { background: #f0f0f0; }
.footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; }
`,
  },
  {
    mode: "LAND",
    documentType: "MANIFIESTO_CARGA",
    html: `
<div class="document-header">
  <h1>MANIFIESTO DE CARGA</h1>
  <div class="header-info">
    <div><strong>Manifest Number:</strong> {{transport.manifestNumber}}</div>
    <div><strong>Date:</strong> {{transport.documentDate}}</div>
  </div>
</div>

<div class="transport-section">
  <h3>INFORMACIÓN DEL TRANSPORTE</h3>
  <table>
    <tr><td>Conductor:</td><td>{{transport.driverName}}</td></tr>
    <tr><td>Licencia:</td><td>{{transport.driverLicense}}</td></tr>
    <tr><td>Placa Tracto:</td><td>{{transport.truckPlate}}</td></tr>
    <tr><td>Placa Remolque:</td><td>{{transport.trailerPlate}}</td></tr>
    <tr><td>Ruta:</td><td>{{transport.placeOfLoading}} → {{transport.placeOfUnloading}}</td></tr>
  </table>
</div>

<div class="cargo-section">
  <h3>DETALLE DE CARGA</h3>
  <table>
    <thead>
      <tr>
        <th>Remitente</th>
        <th>Destinatario</th>
        <th>Descripción</th>
        <th>Cantidad</th>
        <th>Peso (kg)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{{parties.shipper.name}}</td>
        <td>{{parties.consignee.name}}</td>
        <td>{{cargo.goodsDescription}}</td>
        <td>{{cargo.packagesQuantity}} {{cargo.packagesType}}</td>
        <td>{{cargo.grossWeightKg}}</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="footer">
  <p><strong>País Destino:</strong> {{transport.destinationCountry}}</p>
  <p><strong>Almacén:</strong> {{transport.destinationWarehouse}}</p>
</div>
`,
    css: `
body { font-family: Arial, sans-serif; margin: 20px; }
.document-header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
.header-info { display: flex; justify-content: space-between; margin-top: 10px; }
.transport-section, .cargo-section { margin: 20px 0; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; }
th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
th { background: #f0f0f0; }
.footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; }
`,
  },
  {
    mode: "AIR",
    documentType: "HAWB",
    html: `
<div class="document-header">
  <h1>HOUSE AIR WAYBILL</h1>
  <div class="header-info">
    <div><strong>HAWB Number:</strong> {{transport.hawbNumber}}</div>
    <div><strong>Date:</strong> {{#if dates.etd}}{{dates.etd}}{{else}}{{now}}{{/if}}</div>
  </div>
</div>

<div class="parties-section">
  <div class="party-block">
    <h3>SHIPPER</h3>
    <div>{{parties.shipper.name}}</div>
    <div>{{parties.shipper.address}}</div>
    <div>{{parties.shipper.contact}}</div>
  </div>
  
  <div class="party-block">
    <h3>CONSIGNEE</h3>
    <div>{{parties.consignee.name}}</div>
    <div>{{parties.consignee.address}}</div>
    <div>{{parties.consignee.contact}}</div>
  </div>
</div>

<div class="transport-section">
  <h3>ROUTING & DESTINATION</h3>
  <table>
    <tr><td>Airport of Departure:</td><td>{{transport.airportOfDeparture}}</td></tr>
    <tr><td>Airport of Destination:</td><td>{{transport.airportOfDestination}}</td></tr>
    <tr><td>First Carrier:</td><td>{{transport.firstCarrier}}</td></tr>
    {{#if transport.routing}}
    <tr><td>Routing:</td><td>{{#each transport.routing}}{{this}}{{#unless @last}} → {{/unless}}{{/each}}</td></tr>
    {{/if}}
    <tr><td>Requested Flight:</td><td>{{transport.requestedFlight}}</td></tr>
    <tr><td>Requested Flight Date:</td><td>{{transport.requestedFlightDate}}</td></tr>
  </table>
</div>

<div class="cargo-section">
  <h3>NATURE AND QUANTITY OF GOODS</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Quantity</th>
        <th>Weight (kg)</th>
        <th>Dimensions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{{cargo.goodsDescription}}</td>
        <td>{{cargo.packagesQuantity}} {{cargo.packagesType}}</td>
        <td>{{cargo.grossWeightKg}}</td>
        <td>{{cargo.airDimensionsText}}</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="valuation-section">
  <h3>VALUATION & CHARGES</h3>
  <table>
    <tr><td>Currency:</td><td>{{transport.currency}}</td></tr>
    <tr><td>Charges Code:</td><td>{{transport.chargesCode}}</td></tr>
    <tr><td>Declared Value for Carriage:</td><td>{{transport.declaredValueCarriage}}</td></tr>
    <tr><td>Declared Value for Customs:</td><td>{{transport.declaredValueCustoms}}</td></tr>
    <tr><td>Insurance Amount:</td><td>{{transport.insuranceAmount}}</td></tr>
    <tr><td>Payment Term:</td><td>{{transport.paymentTerm}}</td></tr>
  </table>
</div>

<div class="footer">
  <p><strong>Incoterm:</strong> {{shipment.incoterm}}</p>
</div>
`,
    css: `
body { font-family: Arial, sans-serif; margin: 20px; }
.document-header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
.header-info { display: flex; justify-content: space-between; margin-top: 10px; }
.parties-section { display: flex; gap: 20px; margin: 20px 0; }
.party-block { flex: 1; border: 1px solid #ccc; padding: 10px; }
.party-block h3 { margin-top: 0; background: #f0f0f0; padding: 5px; }
.transport-section, .cargo-section, .valuation-section { margin: 20px 0; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; }
th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
th { background: #f0f0f0; }
.footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; }
`,
  },
];

module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("document_templates");

    // Get existing indexes to check for conflicts
    const existingIndexes = await collection.indexes();
    const indexKeyMap = new Map();
    
    // Map existing indexes by their key pattern
    existingIndexes.forEach((index) => {
      const keyStr = JSON.stringify(index.key);
      if (!indexKeyMap.has(keyStr)) {
        indexKeyMap.set(keyStr, []);
      }
      indexKeyMap.get(keyStr).push(index.name);
    });

    // Drop conflicting indexes before creating new ones
    const indexesToCreate = [
      {
        key: { mode: 1, documentType: 1, isActive: 1 },
        options: {
          unique: true,
          partialFilterExpression: { isActive: true },
          name: "mode_documentType_isActive_unique",
        },
      },
      {
        key: { mode: 1, documentType: 1 },
        options: { name: "mode_1_documentType_1" },
      },
      {
        key: { isActive: 1 },
        options: { name: "isActive_1" },
      },
      {
        key: { createdAt: -1 },
        options: { name: "createdAt_-1" },
      },
    ];

    for (const indexSpec of indexesToCreate) {
      const keyStr = JSON.stringify(indexSpec.key);
      const existingNames = indexKeyMap.get(keyStr) || [];

      // Drop existing indexes with same key pattern but different name
      for (const existingName of existingNames) {
        if (existingName !== indexSpec.options.name) {
          try {
            await collection.dropIndex(existingName);
            console.log(`✅ Dropped conflicting index: ${existingName}`);
          } catch (error) {
            console.log(`⚠️ Could not drop index ${existingName}: ${error.message}`);
          }
        }
      }

      // Create the index (or skip if it already exists with correct name)
      if (!existingNames.includes(indexSpec.options.name)) {
        try {
          await collection.createIndex(indexSpec.key, indexSpec.options);
          console.log(`✅ Created index: ${indexSpec.options.name}`);
        } catch (error) {
          // If index already exists, that's fine
          if (error.code !== 85 && error.code !== 86) {
            // 85 = IndexOptionsConflict, 86 = IndexKeySpecsConflict
            throw error;
          }
          console.log(`ℹ️ Index ${indexSpec.options.name} already exists`);
        }
      } else {
        console.log(`ℹ️ Index ${indexSpec.options.name} already exists`);
      }
    }

    console.log("✅ Created indexes for document_templates");

    // Get a user ID from ops_admin role for createdBy
    const user = await db.collection("users").findOne({ roleCode: "ops_admin" });
    if (!user) {
      console.log("⚠️  No ops_admin users found. Skipping template seeding.");
      return;
    }

    const adminUserId = user._id.toString();

    // Seed templates
    for (const template of seedTemplates) {
      // Check if active template already exists
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
          css: (template.css || "").trim(),
          isActive: true,
          createdBy: adminUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(
          `✅ Seeded template: ${template.mode} - ${template.documentType}`,
        );
      } else {
        console.log(
          `ℹ️ Template already exists: ${template.mode} - ${template.documentType}`,
        );
      }
    }

    console.log("✅ Document templates migration completed");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("document_templates");

    // Drop indexes - check for both named and auto-generated names
    const indexesToDrop = [
      "mode_documentType_isActive_unique",
      "mode_1_documentType_1_isActive_1", // Auto-generated name
      "mode_1_documentType_1",
      "isActive_1",
      "createdAt_-1",
    ];

    // Get all existing indexes
    const existingIndexes = await collection.indexes();
    const indexNames = existingIndexes.map((idx) => idx.name);

    for (const indexName of indexesToDrop) {
      if (indexNames.includes(indexName)) {
        try {
          await collection.dropIndex(indexName);
          console.log(`✅ Dropped index: ${indexName}`);
        } catch (error) {
          console.log(`⚠️ Could not drop index ${indexName}: ${error.message}`);
        }
      } else {
        console.log(`ℹ️ Index ${indexName} not found, skipping`);
      }
    }

    // Delete seeded templates
    await collection.deleteMany({
      mode: { $in: ["OCEAN", "LAND", "AIR"] },
      documentType: {
        $in: ["BL", "CARTA_PORTE", "MANIFIESTO_CARGA", "HAWB"],
      },
    });

    console.log("❌ Document templates migration reversed");
  },
};
