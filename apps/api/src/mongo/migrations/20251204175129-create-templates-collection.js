module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create templates collection only if it doesn't exist
    const collections = await db.listCollections({ name: "templates" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("templates");
      console.log("✅ Created templates collection");
    } else {
      console.log("ℹ️  Templates collection already exists, skipping creation");
    }
    
    const collection = db.collection("templates");
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

    // Create indexes for templates collection
    await ensureIndex({ name: 1 });
    await ensureIndex({ companyId: 1 });
    await ensureIndex({ incoterm: 1 });
    await ensureIndex({ serviceType: 1 });
    await ensureIndex({ createdBy: 1 });
    await ensureIndex({ isActive: 1 });
    await ensureIndex({ createdAt: -1 });
    
    console.log("✅ Templates collection created with indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove templates collection
    await db.collection("templates").drop();
    console.log("❌ Templates collection dropped");
  }
};
