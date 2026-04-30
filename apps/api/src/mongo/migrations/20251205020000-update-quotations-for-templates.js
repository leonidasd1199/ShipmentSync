module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("quotations");

    // Migrate existing items to legacyItems for backward compatibility
    await collection.updateMany(
      { items: { $exists: true, $ne: [] }, legacyItems: { $exists: false } },
      [
        {
          $set: {
            legacyItems: "$items",
            items: [],
            headerFieldValues: [],
            equipmentItems: [],
            showAgentToClient: true,
            showCarrierToClient: true,
            showCommodityToClient: true,
            showNotesToClient: true,
          },
        },
      ],
    );
    console.log("✅ Migrated existing items to legacyItems");

    // Create indexes
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

    await ensureIndex({ templateId: 1 });
    await ensureIndex({ portOfOrigin: 1 });
    await ensureIndex({ portOfDestination: 1 });

    console.log("✅ Quotations schema migration completed");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("quotations");

    // Reverse: Move legacyItems back to items
    await collection.updateMany(
      { legacyItems: { $exists: true, $ne: [] } },
      {
        $set: {
          items: "$legacyItems",
        },
        $unset: {
          legacyItems: "",
          templateId: "",
          portOfOrigin: "",
          portOfDestination: "",
          headerFieldValues: "",
          equipmentItems: "",
          pricingConfig: "",
          showAgentToClient: "",
          showCarrierToClient: "",
          showCommodityToClient: "",
          showNotesToClient: "",
        },
      },
    );

    // Drop indexes
    const existingIndexes = await collection.indexes();
    const indexesToDrop = ["templateId_1", "portOfOrigin_1", "portOfDestination_1"];
    
    for (const indexName of indexesToDrop) {
      if (existingIndexes.some(i => i.name === indexName)) {
        await collection.dropIndex(indexName);
        console.log(`🗑️ Dropped index: ${indexName}`);
      }
    }

    console.log("❌ Quotations schema migration reversed");
  },
};

