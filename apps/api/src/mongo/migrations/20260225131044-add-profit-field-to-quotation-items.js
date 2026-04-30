module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("quotations");

    // Add profit field to all items in quotations
    // For existing items, profit will be null/undefined (optional field)
    await collection.updateMany(
      {
        items: { $exists: true, $ne: [] },
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
                      profit: {
                        $ifNull: ["$$item.profit", null],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      ],
    );

    console.log("✅ Added profit field to quotation items");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("quotations");

    // Remove profit field from all items in quotations
    await collection.updateMany(
      {
        items: { $exists: true, $ne: [] },
      },
      [
        {
          $set: {
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  $arrayToObject: {
                    $filter: {
                      input: { $objectToArray: "$$item" },
                      as: "field",
                      cond: { $ne: ["$$field.k", "profit"] },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    );

    console.log("❌ Removed profit field from quotation items");
  },
};
