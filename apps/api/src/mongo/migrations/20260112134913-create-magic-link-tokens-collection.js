module.exports = {
  async up(db, client) {
    const collections = await db
      .listCollections({ name: "magic_link_tokens" })
      .toArray();

    if (collections.length === 0) {
      await db.createCollection("magic_link_tokens");
      console.log("✅ Created magic_link_tokens collection");
    } else {
      console.log(
        "ℹ️ Magic link tokens collection already exists, skipping creation"
      );
    }

    const collection = db.collection("magic_link_tokens");
    const existingIndexes = await collection.indexes();

    const ensureIndex = async (key, options = {}) => {
      const indexName =
        options.name ||
        Object.keys(key)
          .map((k) => `${k}_${key[k]}`)
          .join("_");

      const exists = existingIndexes.some(
        (i) => JSON.stringify(i.key) === JSON.stringify(key)
      );

      if (!exists) {
        await collection.createIndex(key, options);
        console.log(`✅ Created index: ${indexName}`);
      } else {
        console.log(
          `ℹ️ Index for ${JSON.stringify(key)} already exists, skipping`
        );
      }
    };

    await ensureIndex({ token: 1 }, { unique: true });

    await ensureIndex({ agentId: 1, used: 1 });

    await ensureIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "expiresAt_ttl" }
    );

    console.log("✅ Magic link tokens collection created with indexes");
  },

  async down(db, client) {
    await db.collection("magic_link_tokens").drop();
    console.log("❌ Magic link tokens collection dropped");
  },
};