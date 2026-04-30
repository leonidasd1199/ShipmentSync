module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create agent_pricelists collection only if it doesn't exist
    const collections = await db
      .listCollections({ name: "agent_pricelists" })
      .toArray();
    if (collections.length === 0) {
      await db.createCollection("agent_pricelists");
      console.log("✅ Created agent_pricelists collection");
    } else {
      console.log(
        "ℹ️  Agent pricelists collection already exists, skipping creation",
      );
    }

    const collection = db.collection("agent_pricelists");
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
        console.log(`ℹ️ Index ${indexName} already exists, skipping`);
      }
    };

    // Compound index for agent + supplier queries (not unique — one pricelist per week, not per supplier forever)
    await ensureIndex({ agentId: 1, supplierId: 1 });

    // Individual indexes for querying
    await ensureIndex({ agentId: 1 });
    await ensureIndex({ supplierId: 1 });
    await ensureIndex({ createdAt: -1 });

    console.log("✅ Agent pricelists collection created with indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove agent_pricelists collection
    await db.collection("agent_pricelists").drop();
    console.log("❌ Agent pricelists collection dropped");
  },
};
