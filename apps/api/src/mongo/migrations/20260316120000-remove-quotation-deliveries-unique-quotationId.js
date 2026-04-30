module.exports = {
  /**
   * Remove unique constraint on quotation_deliveries.quotationId so multiple
   * delivery records per quotation are allowed (dedup is by snapshot in app code).
   *
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("quotation_deliveries");
    const indexes = await collection.indexes();

    // Drop unique index on quotationId (Mongoose default name is quotationId_1)
    const toDrop = indexes.find(
      (idx) =>
        idx.unique === true &&
        idx.key &&
        idx.key.quotationId === 1 &&
        Object.keys(idx.key).length === 1
    );
    if (toDrop) {
      await collection.dropIndex(toDrop.name);
      console.log(`✅ Dropped unique index: ${toDrop.name}`);
    } else {
      console.log("ℹ️  No unique quotationId index found, skipping");
    }

    // Ensure non-unique index on quotationId (for queries)
    try {
      await collection.createIndex({ quotationId: 1 }, { unique: false });
      console.log("✅ Created non-unique index on quotationId");
    } catch (e) {
      if (e.code === 85 || e.codeName === "IndexOptionsConflict" || e.message?.includes("already exists")) {
        console.log("ℹ️  Index on quotationId already exists, skipping");
      } else {
        throw e;
      }
    }

    // Compound index for "latest delivery by quotationId"
    try {
      await collection.createIndex({ quotationId: 1, sentAt: -1 });
      console.log("✅ Created compound index (quotationId, sentAt)");
    } catch (e) {
      if (e.code === 85 || e.codeName === "IndexOptionsConflict" || e.message?.includes("already exists")) {
        console.log("ℹ️  Compound index already exists, skipping");
      } else {
        throw e;
      }
    }
  },

  async down(db, client) {
    const collection = db.collection("quotation_deliveries");
    const indexes = await collection.indexes();

    const compound = indexes.find((i) => i.name === "quotationId_1_sentAt_-1");
    if (compound) {
      await collection.dropIndex(compound.name);
      console.log("✅ Dropped compound index");
    }
    const nonUnique = indexes.find((i) => i.name === "quotationId_1" && i.unique !== true);
    if (nonUnique) {
      await collection.dropIndex(nonUnique.name);
      console.log("✅ Dropped non-unique quotationId index");
    }
    await collection.createIndex({ quotationId: 1 }, { unique: true });
    console.log("✅ Restored unique index on quotationId");
  },
};
