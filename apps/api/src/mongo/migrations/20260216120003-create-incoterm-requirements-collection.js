module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create incoterm_requirements collection only if it doesn't exist
    const collections = await db
      .listCollections({ name: "incoterm_requirements" })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection("incoterm_requirements");
      console.log("✅ Created incoterm_requirements collection");
    } else {
      console.log(
        "ℹ️  Incoterm_requirements collection already exists, skipping creation",
      );
    }

    const collection = db.collection("incoterm_requirements");
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

    // Create indexes for incoterm_requirements collection

    // Unique constraint: (mode, incoterm)
    await ensureIndex({ mode: 1, incoterm: 1 }, { unique: true });

    // Index for querying active requirements
    await ensureIndex({ active: 1, mode: 1 });

    // Index for querying by mode
    await ensureIndex({ mode: 1 });

    // Index for querying by incoterm
    await ensureIndex({ incoterm: 1 });

    console.log("✅ Incoterm_requirements collection created with all indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove incoterm_requirements collection
    await db.collection("incoterm_requirements").drop();
    console.log("❌ Incoterm_requirements collection dropped");
  },
};