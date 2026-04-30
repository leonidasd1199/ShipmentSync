module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create shipment_documents collection only if it doesn't exist
    const collections = await db
      .listCollections({ name: "shipment_documents" })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection("shipment_documents");
      console.log("✅ Created shipment_documents collection");
    } else {
      console.log(
        "ℹ️  Shipment_documents collection already exists, skipping creation",
      );
    }

    const collection = db.collection("shipment_documents");
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

    // Create indexes for shipment_documents collection

    // Unique constraint: (shipmentId, documentType, version)
    await ensureIndex(
      { shipmentId: 1, documentType: 1, version: 1 },
      { unique: true },
    );

    // Index for querying by shipment, document type, and status
    await ensureIndex({ shipmentId: 1, documentType: 1, status: 1 });

    // Index for querying by shipment and status
    await ensureIndex({ shipmentId: 1, status: 1 });

    // Index for querying by document type
    await ensureIndex({ documentType: 1 });

    // Index for querying by generated date
    await ensureIndex({ generatedAt: -1 });

    // Index for querying locked documents
    await ensureIndex({ lockedBy: 1, lockedAt: -1 });

    console.log("✅ Shipment_documents collection created with all indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove shipment_documents collection
    await db.collection("shipment_documents").drop();
    console.log("❌ Shipment_documents collection dropped");
  },
};