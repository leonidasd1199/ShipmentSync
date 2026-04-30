module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {

    // Create roles collection only if it doesn't exist
    const collections = await db.listCollections({ name: "roles" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("roles");
      console.log("✅ Created roles collection");
    } else {
      console.log("ℹ️ Roles collection already exists, skipping creation");
    }

    // Create unique index on code field
    await db.collection("roles").createIndex({ code: 1 }, { unique: true });

    // Insert initial roles
    await db.collection("roles").insertMany([
      {
        code: "ops_admin",
        name: "OPS_ADMIN",
        description: "Operations administrator with full system access",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "client",
        name: "Client",
        description: "End customers who ship packages",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "admin",
        name: "Admin",
        description: "System administrator",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    console.log("✅ Roles collection created and populated");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    await db.collection("roles").drop();
    console.log("❌ Roles collection dropped");
  }
};