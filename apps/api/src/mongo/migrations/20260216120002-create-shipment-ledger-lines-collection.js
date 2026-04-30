module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create shipment_ledger_lines collection only if it doesn't exist
    const collections = await db
      .listCollections({ name: "shipment_ledger_lines" })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection("shipment_ledger_lines");
      console.log("✅ Created shipment_ledger_lines collection");
    } else {
      console.log(
        "ℹ️  Shipment_ledger_lines collection already exists, skipping creation",
      );
    }

    const collection = db.collection("shipment_ledger_lines");
    const existingIndexes = await collection.indexes();

    const ensureIndex = async (key, options = {}) => {
      const indexName =
        options.name ||
        Object.keys(key)
          .map((k) => `${k}_${key[k]}`)
          .join("_");
      const exists = existingIndexes.some((i) => i.name === indexName);
      if (!exists) {
        await collection.createIndex(key, options);
        console.log(`✅ Created index: ${indexName}`);
      } else {
        console.log(`ℹ️  Index ${indexName} already exists, skipping`);
      }
    };

    // Create indexes for shipment_ledger_lines collection

    // Index for querying by shipment, side, and status
    await ensureIndex({ shipmentId: 1, side: 1, status: 1 });

    // Index for querying by shipment and status
    await ensureIndex({ shipmentId: 1, status: 1 });

    // Index for querying by source quotation
    await ensureIndex({ sourceQuotationId: 1 }, { sparse: true });

    // Index for querying by side
    await ensureIndex({ side: 1, status: 1 });

    // Index for querying by created date
    await ensureIndex({ createdAt: -1 });

    console.log("✅ Shipment_ledger_lines collection created with all indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove shipment_ledger_lines collection
    await db.collection("shipment_ledger_lines").drop();
    console.log("❌ Shipment_ledger_lines collection dropped");
  },
};