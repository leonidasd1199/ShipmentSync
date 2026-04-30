module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("shipments");

    // Rename estimateId to quotationId
    await collection.updateMany(
      { estimateId: { $exists: true } },
      [
        {
          $set: {
            quotationId: "$estimateId",
          },
        },
        {
          $unset: "estimateId",
        },
      ],
    );

    console.log("✅ Renamed estimateId to quotationId");

    // Drop old index and create new one
    const existingIndexes = await collection.indexes();
    const estimateIdIndex = existingIndexes.find(
      (idx) => idx.key && idx.key.estimateId,
    );
    const quotationIdIndex = existingIndexes.find(
      (idx) => idx.key && idx.key.quotationId,
    );

    if (estimateIdIndex) {
      try {
        await collection.dropIndex(estimateIdIndex.name);
        console.log(`✅ Dropped old index: ${estimateIdIndex.name}`);
      } catch (error) {
        console.log(
          `⚠️ Could not drop index ${estimateIdIndex.name}: ${error.message}`,
        );
      }
    }

    if (!quotationIdIndex) {
      await collection.createIndex({ quotationId: 1 });
      console.log("✅ Created index on quotationId");
    } else {
      console.log("ℹ️ Index on quotationId already exists");
    }

    console.log("✅ Migration completed: estimateId → quotationId");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("shipments");

    // Rename quotationId back to estimateId
    await collection.updateMany(
      { quotationId: { $exists: true } },
      [
        {
          $set: {
            estimateId: "$quotationId",
          },
        },
        {
          $unset: "quotationId",
        },
      ],
    );

    console.log("✅ Renamed quotationId back to estimateId");

    // Drop new index and recreate old one
    const existingIndexes = await collection.indexes();
    const quotationIdIndex = existingIndexes.find(
      (idx) => idx.key && idx.key.quotationId,
    );
    const estimateIdIndex = existingIndexes.find(
      (idx) => idx.key && idx.key.estimateId,
    );

    if (quotationIdIndex) {
      try {
        await collection.dropIndex(quotationIdIndex.name);
        console.log(`✅ Dropped index: ${quotationIdIndex.name}`);
      } catch (error) {
        console.log(
          `⚠️ Could not drop index ${quotationIdIndex.name}: ${error.message}`,
        );
      }
    }

    if (!estimateIdIndex) {
      await collection.createIndex({ estimateId: 1 });
      console.log("✅ Created index on estimateId");
    } else {
      console.log("ℹ️ Index on estimateId already exists");
    }

    // Remove quotationSnapshot field if it exists
    await collection.updateMany(
      { quotationSnapshot: { $exists: true } },
      {
        $unset: {
          quotationSnapshot: "",
        },
      },
    );

    console.log("✅ Migration reversed: quotationId → estimateId");
  },
};
