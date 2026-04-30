module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create shipments collection only if it doesn't exist
    const collections = await db
      .listCollections({ name: "shipments" })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection("shipments");
      console.log("✅ Created shipments collection");
    } else {
      console.log(
        "ℹ️  Shipments collection already exists, skipping creation",
      );
    }

    const collection = db.collection("shipments");
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

    // Create indexes for shipments collection

    // Index for querying shipments by company (most recent first)
    await ensureIndex({ companyId: 1, createdAt: -1 });

    // Index for querying shipments by office (most recent first)
    await ensureIndex({ officeId: 1, createdAt: -1 });

    // Index for querying shipments by estimate/quotation
    await ensureIndex({ estimateId: 1 });

    // Index for querying shipments by status (most recent first)
    await ensureIndex({ status: 1, createdAt: -1 });

    // Index for querying shipments by operational user and status
    await ensureIndex({ operationalUserId: 1, status: 1 });

    // Index for querying by booking number
    await ensureIndex({ bookingNumber: 1 });

    // Index for querying by MBL number
    await ensureIndex({ mblNumber: 1 });

    // Index for querying by HBL number
    await ensureIndex({ hblNumber: 1 });

    // Index for querying by shipping line
    await ensureIndex({ shippingLineId: 1 });

    // Index for querying by shipper client
    await ensureIndex({ "parties.shipper.clientId": 1 });

    // Index for querying by consignee client
    await ensureIndex({ "parties.consignee.clientId": 1 });

    // Index for querying by port of loading
    await ensureIndex({ "transport.portOfLoadingId": 1 });

    // Index for querying by port of discharge
    await ensureIndex({ "transport.portOfDischargeId": 1 });

    // Index for querying locked shipments
    await ensureIndex({ lockedBy: 1 });

    // Index for querying recent shipments
    await ensureIndex({ createdAt: -1 });

    console.log("✅ Shipments collection created with all indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove shipments collection
    await db.collection("shipments").drop();
    console.log("❌ Shipments collection dropped");
  },
};