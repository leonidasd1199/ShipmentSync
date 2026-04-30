module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collections = await db
      .listCollections({ name: "quotation_deliveries" })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection("quotation_deliveries");
      console.log("✅ Created quotation_deliveries collection");
    } else {
      console.log(
        "ℹ️  quotation_deliveries collection already exists, skipping creation",
      );
    }

    const collection = db.collection("quotation_deliveries");
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

    await ensureIndex({ quotationId: 1 }, { unique: true });
    await ensureIndex({ clientId: 1 });
    await ensureIndex({ companyId: 1 });
    await ensureIndex({ sentAt: -1 });
    await ensureIndex({ sentBy: 1 });
    await ensureIndex({ officeId: 1 });

    console.log(
      "✅ quotation_deliveries collection created with all indexes",
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    await db.collection("quotation_deliveries").drop();
    console.log("❌ quotation_deliveries collection dropped");
  },
};
