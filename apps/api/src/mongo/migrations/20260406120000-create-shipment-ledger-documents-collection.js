module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const name = "shipment_ledger_documents";
    const collections = await db.listCollections({ name }).toArray();
    if (collections.length === 0) {
      await db.createCollection(name);
      console.log(`✅ Created ${name} collection`);
    } else {
      console.log(`ℹ️  ${name} collection already exists, skipping creation`);
    }

    const collection = db.collection(name);
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

    await ensureIndex({ ledgerLineId: 1 });
    await ensureIndex({ shipmentId: 1 });
    await ensureIndex({ uploadedBy: 1 });
    await ensureIndex({ createdAt: -1 });
    await ensureIndex({ ledgerLineId: 1, createdAt: -1 });

    console.log(`✅ ${name} indexes ensured`);
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const name = "shipment_ledger_documents";
    const collections = await db.listCollections({ name }).toArray();
    if (collections.length === 0) {
      console.log(`ℹ️  ${name} does not exist, skipping drop`);
      return;
    }
    await db.collection(name).drop();
    console.log(`❌ ${name} collection dropped`);
  },
};
