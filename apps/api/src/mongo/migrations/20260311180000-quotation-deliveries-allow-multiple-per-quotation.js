module.exports = {
  /**
   * Allow multiple QuotationDelivery records per quotationId.
   * Drops the unique index on quotationId and ensures a non-unique index exists.
   * Adds compound index (quotationId, sentAt desc) for efficient "latest by quotation" lookup.
   *
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("quotation_deliveries");
    const indexes = await collection.indexes();

    const uniqueQuotationIdIndex = indexes.find(
      (idx) =>
        idx.unique === true &&
        idx.key &&
        Object.keys(idx.key).length === 1 &&
        idx.key.quotationId !== undefined
    );

    if (uniqueQuotationIdIndex) {
      await collection.dropIndex(uniqueQuotationIdIndex.name);
      console.log(
        `✅ Dropped unique index on quotationId: ${uniqueQuotationIdIndex.name}`,
      );
    } else {
      console.log(
        "ℹ️  No unique index on quotationId found, skipping drop",
      );
    }

    const indexNames = indexes.map((i) => i.name);
    const ensureIndex = async (key, options = {}) => {
      const name =
        options.name ||
        Object.keys(key)
          .map((k) => `${k}_${key[k]}`)
          .join("_");
      if (!indexNames.includes(name)) {
        await collection.createIndex(key, { ...options, name });
        console.log(`✅ Created index: ${name}`);
      } else {
        console.log(`ℹ️  Index ${name} already exists, skipping`);
      }
    };

    await ensureIndex({ quotationId: 1 });
    await ensureIndex({ quotationId: 1, sentAt: -1 });

    console.log(
      "✅ quotation_deliveries indexes updated for multiple deliveries per quotation",
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("quotation_deliveries");
    const indexes = await collection.indexes();

    const compoundQuotationIdSentAt = indexes.find(
      (idx) =>
        idx.key &&
        idx.key.quotationId === 1 &&
        idx.key.sentAt === -1
    );
    if (compoundQuotationIdSentAt) {
      await collection.dropIndex(compoundQuotationIdSentAt.name);
      console.log(
        `✅ Dropped compound index: ${compoundQuotationIdSentAt.name}`,
      );
    }

    const nonUniqueQuotationId = indexes.find(
      (idx) =>
        idx.name === "quotationId_1" &&
        idx.unique !== true
    );
    if (nonUniqueQuotationId) {
      await collection.dropIndex(nonUniqueQuotationId.name);
      console.log(`✅ Dropped non-unique quotationId index`);
    }

    await collection.createIndex({ quotationId: 1 }, { unique: true });
    console.log("✅ Restored unique index on quotationId");

    console.log("❌ quotation_deliveries reverted to unique quotationId");
  },
};
