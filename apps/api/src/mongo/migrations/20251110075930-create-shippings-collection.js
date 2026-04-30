module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create shippings collection only if it doesn't exist
    const collections = await db.listCollections({ name: "shippings" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("shippings");
      console.log("✅ Created shippings collection");
    } else {
      console.log("ℹ️  Shippings collection already exists, skipping creation");
    }
    
    const collection = db.collection("shippings");
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

    // Create indexes for shippings collection
    await ensureIndex({ name: 1 });
    await ensureIndex({ email: 1 });
    await ensureIndex({ isActive: 1 }, {});
    await ensureIndex({ createdAt: -1 }, {});

    // Insert sample shipping data
    const count = await collection.countDocuments();
    if (count === 0) {
      await collection.insertOne({
        name: "Maersk Line",
        legalName: "Maersk A/S",
        email: "info@maersk.com",
        phone: "+504 9999-8888",
        website: "https://www.maersk.com",
        notes: "Naviera global con operaciones en Honduras.",
        agents: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log("✅ Inserted sample shipping data");
    } else {
      console.log("ℹ️  Shippings collection already has data, skipping seed");
    }
    
    console.log("✅ Shippings collection created with indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove shippings collection
    await db.collection("shippings").drop();
    console.log("❌ Shippings collection dropped");
  }
};

