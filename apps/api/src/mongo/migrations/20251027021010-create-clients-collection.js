module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create clients collection only if it doesn't exist
    const collections = await db.listCollections({ name: "clients" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("clients");
      console.log("✅ Created clients collection");
    } else {
      console.log("ℹ️  Clients collection already exists, skipping creation");
    }
    
    // Create indexes for clients collection
    await db.collection("clients").createIndex({ office: 1 });
    await db.collection("clients").createIndex({ name: 1 });
    await db.collection("clients").createIndex({ isActive: 1 });
    await db.collection("clients").createIndex({ createdAt: -1 });
    await db.collection("clients").createIndex({ email: 1 });
    
    console.log("✅ Clients collection created with indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove clients collection
    await db.collection("clients").drop();
    console.log("❌ Clients collection dropped");
  }
};
