module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("templates");

    // 1. Rename incoterm → category
    await collection.updateMany(
      { incoterm: { $exists: true } },
      [{ $set: { category: "$incoterm" } }, { $unset: "incoterm" }],
    );
    console.log("✅ Renamed incoterm → category");

    // 2. Add shippingModes field (default to ["maritime"] if not exists)
    await collection.updateMany(
      { shippingModes: { $exists: false } },
      { $set: { shippingModes: ["maritime"] } },
    );
    console.log("✅ Added shippingModes field");

    // 3. Rename priceConfiguration → pricingConfig
    await collection.updateMany(
      { priceConfiguration: { $exists: true } },
      [{ $set: { pricingConfig: "$priceConfiguration" } }, { $unset: "priceConfiguration" }],
    );
    console.log("✅ Renamed priceConfiguration → pricingConfig");

    // 4. Rename generalNotes → notes
    await collection.updateMany(
      { generalNotes: { $exists: true } },
      [{ $set: { notes: "$generalNotes" } }, { $unset: "generalNotes" }],
    );
    console.log("✅ Renamed generalNotes → notes");

    // 5. Flatten visibilityRules object into individual fields
    await collection.updateMany(
      { visibilityRules: { $exists: true } },
      [
        {
          $set: {
            showAgentToClient: { $ifNull: ["$visibilityRules.showAgentToClient", true] },
            showCarrierToClient: { $ifNull: ["$visibilityRules.showCarrierToClient", true] },
            showCommodityToClient: { $ifNull: ["$visibilityRules.showCommodityToClient", true] },
            showNotesToClient: { $ifNull: ["$visibilityRules.showNotesToClient", true] },
          },
        },
        { $unset: "visibilityRules" },
      ],
    );
    console.log("✅ Flattened visibilityRules into individual fields");

    // 6. Set default values for visibility fields if they don't exist
    await collection.updateMany(
      {
        $or: [
          { showAgentToClient: { $exists: false } },
          { showCarrierToClient: { $exists: false } },
          { showCommodityToClient: { $exists: false } },
          { showNotesToClient: { $exists: false } },
        ],
      },
      {
        $set: {
          showAgentToClient: { $ifNull: ["$showAgentToClient", true] },
          showCarrierToClient: { $ifNull: ["$showCarrierToClient", true] },
          showCommodityToClient: { $ifNull: ["$showCommodityToClient", true] },
          showNotesToClient: { $ifNull: ["$showNotesToClient", true] },
        },
      },
    );
    console.log("✅ Set default values for visibility fields");

    // 7. Update indexes
    const existingIndexes = await collection.indexes();
    
    // Drop old incoterm index if it exists
    const incotermIndex = existingIndexes.find((idx) => idx.name === "incoterm_1");
    if (incotermIndex) {
      await collection.dropIndex("incoterm_1");
      console.log("🗑️ Dropped old index: incoterm_1");
    }

    // Create new category index
    const categoryIndexExists = existingIndexes.some((idx) => idx.name === "category_1");
    if (!categoryIndexExists) {
      await collection.createIndex({ category: 1 }, { background: true });
      console.log("✅ Created index: category_1");
    }

    // Create shippingModes index
    const shippingModesIndexExists = existingIndexes.some((idx) => idx.name === "shippingModes_1");
    if (!shippingModesIndexExists) {
      await collection.createIndex({ shippingModes: 1 }, { background: true });
      console.log("✅ Created index: shippingModes_1");
    }

    // Create updatedBy index
    const updatedByIndexExists = existingIndexes.some((idx) => idx.name === "updatedBy_1");
    if (!updatedByIndexExists) {
      await collection.createIndex({ updatedBy: 1 }, { background: true });
      console.log("✅ Created index: updatedBy_1");
    }

    console.log("✅ Template schema migration completed");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("templates");

    // Reverse: Rename category → incoterm
    await collection.updateMany(
      { category: { $exists: true } },
      [{ $set: { incoterm: "$category" } }, { $unset: "category" }],
    );

    // Reverse: Remove shippingModes
    await collection.updateMany({}, { $unset: { shippingModes: "" } });

    // Reverse: Rename pricingConfig → priceConfiguration
    await collection.updateMany(
      { pricingConfig: { $exists: true } },
      [{ $set: { priceConfiguration: "$pricingConfig" } }, { $unset: "pricingConfig" }],
    );

    // Reverse: Rename notes → generalNotes
    await collection.updateMany(
      { notes: { $exists: true } },
      [{ $set: { generalNotes: "$notes" } }, { $unset: "notes" }],
    );

    // Reverse: Recreate visibilityRules object
    await collection.updateMany(
      {},
      {
        $set: {
          visibilityRules: {
            showAgentToClient: { $ifNull: ["$showAgentToClient", true] },
            showCarrierToClient: { $ifNull: ["$showCarrierToClient", true] },
            showCommodityToClient: { $ifNull: ["$showCommodityToClient", true] },
            showNotesToClient: { $ifNull: ["$showNotesToClient", true] },
          },
        },
        $unset: {
          showAgentToClient: "",
          showCarrierToClient: "",
          showCommodityToClient: "",
          showNotesToClient: "",
        },
      },
    );

    // Reverse indexes
    const existingIndexes = await collection.indexes();
    
    if (existingIndexes.some((idx) => idx.name === "category_1")) {
      await collection.dropIndex("category_1");
    }
    if (existingIndexes.some((idx) => idx.name === "shippingModes_1")) {
      await collection.dropIndex("shippingModes_1");
    }
    if (existingIndexes.some((idx) => idx.name === "updatedBy_1")) {
      await collection.dropIndex("updatedBy_1");
    }
    if (!existingIndexes.some((idx) => idx.name === "incoterm_1")) {
      await collection.createIndex({ incoterm: 1 }, { background: true });
    }

    console.log("❌ Template schema migration reversed");
  },
};

