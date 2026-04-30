module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create ports collection only if it doesn't exist
    const collections = await db.listCollections({ name: "ports" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("ports");
      console.log("✅ Created ports collection");
    } else {
      console.log("ℹ️  Ports collection already exists, skipping creation");
    }
    
    const collection = db.collection("ports");
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

    // Create indexes for ports collection
    await ensureIndex({ name: 1 });
    await ensureIndex({ unlocode: 1 });
    await ensureIndex({ countryCode: 1 });
    await ensureIndex({ type: 1 });
    await ensureIndex({ isActive: 1 });
    await ensureIndex({ createdAt: -1 });
    await ensureIndex({ name: 1, countryCode: 1 }); // Compound index
    
    console.log("✅ Ports collection created with indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove ports collection
    await db.collection("ports").drop();
    console.log("❌ Ports collection dropped");
  }
};

