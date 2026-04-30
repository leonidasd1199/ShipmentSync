module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create pricelist_distributions collection only if it doesn't exist
    const collections = await db
      .listCollections({ name: "pricelist_distributions" })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection("pricelist_distributions");
      console.log("✅ Created pricelist_distributions collection");
    } else {
      console.log(
        "ℹ️  Pricelist_distributions collection already exists, skipping creation",
      );
    }

    const collection = db.collection("pricelist_distributions");
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

    // Create indexes for pricelist_distributions collection
    // Index for querying distributions by pricelist (most recent first)
    await ensureIndex({ pricelistId: 1, sentAt: -1 });

    // Index for querying distributions by client
    await ensureIndex({ clientIds: 1 });

    // Index for querying distributions by operator who sent them
    await ensureIndex({ sentBy: 1 });

    // Index for querying recent distributions
    await ensureIndex({ sentAt: -1 });

    console.log(
      "✅ Pricelist_distributions collection created with all indexes",
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove pricelist_distributions collection
    await db.collection("pricelist_distributions").drop();
    console.log("❌ Pricelist_distributions collection dropped");
  },
};
