module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create quotations collection only if it doesn't exist
    const collections = await db.listCollections({ name: "quotations" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("quotations");
      console.log("✅ Created quotations collection");
    } else {
      console.log("ℹ️  Quotations collection already exists, skipping creation");
    }
    
    const collection = db.collection("quotations");
    const existingIndexes = await collection.indexes();

    const ensureIndex = async (key, options = {}) => {
      const indexName = options.name || Object.keys(key).map(k => `${k}_${key[k]}`).join("_");
      const exists = existingIndexes.some(i => i.name === indexName);
      if (!exists) {
        await collection.createIndex(key, options);
        console.log(`✅ Created index: ${indexName}`);
      } else {
        console.log(`ℹ️ Index ${indexName} already exists, skipping`);
      }
    };

    // Create indexes for quotations collection
    await ensureIndex({ clientId: 1 });
    await ensureIndex({ companyId: 1 });
    await ensureIndex({ shippingLineId: 1 });
    await ensureIndex({ agentId: 1 });
    await ensureIndex({ validUntil: 1 });
    await ensureIndex({ createdAt: -1 });
    await ensureIndex({ clientId: 1, companyId: 1 });
    
    console.log("✅ Quotations collection created with indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove quotations collection
    await db.collection("quotations").drop();
    console.log("❌ Quotations collection dropped");
  }
};

