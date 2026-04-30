module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("agent_pricelists");

    // Check if collection exists
    const collections = await db
      .listCollections({ name: "agent_pricelists" })
      .toArray();
    if (collections.length === 0) {
      console.log(
        "ℹ️  Agent pricelists collection does not exist, skipping migration",
      );
      return;
    }

    console.log("🔄 Updating pricelist items schema...");

    // Update all pricelists that have items
    // Add chargeType field (required) - default to "OTHER" for existing items
    // Add all optional fields (they'll be undefined/null for existing items)
    const result = await collection.updateMany(
      {
        "items": { $exists: true, $ne: [] },
      },
      [
        {
          $set: {
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  $mergeObjects: [
                    "$$item",
                    {
                      // Add chargeType if it doesn't exist (default to OTHER)
                      chargeType: {
                        $ifNull: ["$$item.chargeType", "OTHER"],
                      },
                      // Optional fields - keep existing values or set to null
                      equipmentType: "$$item.equipmentType",
                      lane: "$$item.lane",
                      pricingUnit: "$$item.pricingUnit",
                      validFrom: "$$item.validFrom",
                      validTo: "$$item.validTo",
                      freeTimeDays: "$$item.freeTimeDays",
                      transitTimeDaysMin: "$$item.transitTimeDaysMin",
                      transitTimeDaysMax: "$$item.transitTimeDaysMax",
                      carrierName: "$$item.carrierName",
                      // Keep existing metadata
                      metadata: "$$item.metadata",
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    );

    console.log(
      `✅ Updated ${result.modifiedCount} pricelist(s) with new item schema`,
    );
    console.log(
      `ℹ️  ${result.matchedCount - result.modifiedCount} pricelist(s) already had the new schema or had no items`,
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("agent_pricelists");

    console.log("🔄 Reverting pricelist items schema...");

    // Remove new fields from items (keep only: name, incoterm, cost, currency, metadata)
    const result = await collection.updateMany(
      {
        "items": { $exists: true, $ne: [] },
      },
      [
        {
          $set: {
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  name: "$$item.name",
                  incoterm: "$$item.incoterm",
                  cost: "$$item.cost",
                  currency: "$$item.currency",
                  metadata: "$$item.metadata",
                },
              },
            },
          },
        },
      ],
    );

    console.log(
      `✅ Reverted ${result.modifiedCount} pricelist(s) to old item schema`,
    );
  },
};
