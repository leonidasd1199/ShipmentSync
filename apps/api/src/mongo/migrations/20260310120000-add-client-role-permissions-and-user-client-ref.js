module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Ensure client:read and client:list permissions exist and get their IDs
    const permDocs = await db
      .collection("permissions")
      .find({ code: { $in: ["client:read", "client:list"] } })
      .toArray();
    const permissionIds = permDocs.map((p) => p._id);

    if (permissionIds.length === 0) {
      console.log("⚠️  client:read and client:list permissions not found. Skipping permission assignment.");
    } else {
      // Assign client:read and client:list to all users with roleCode "client"
      const result = await db.collection("users").updateMany(
        { roleCode: "client" },
        { $addToSet: { permissions: { $each: permissionIds } } },
      );
      console.log(`✅ Assigned client:read and client:list to ${result.modifiedCount} client-role user(s).`);
    }

    // Optional: add index on users.client for client-scoped queries
    try {
      await db.collection("users").createIndex({ client: 1 }, { sparse: true });
      console.log("✅ Created index on users.client");
    } catch (e) {
      if (e.code === 85 || e.codeName === "IndexOptionsConflict") {
        console.log("ℹ️  Index users.client already exists or conflict, skipping.");
      } else {
        throw e;
      }
    }
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const permDocs = await db
      .collection("permissions")
      .find({ code: { $in: ["client:read", "client:list"] } })
      .toArray();
    const permissionIds = permDocs.map((p) => p._id);

    if (permissionIds.length > 0) {
      await db.collection("users").updateMany(
        { roleCode: "client" },
        { $pull: { permissions: { $in: permissionIds } } },
      );
      console.log("❌ Removed client:read and client:list from client-role users.");
    }

    try {
      await db.collection("users").dropIndex("client_1");
    } catch (e) {
      if (e.code === 27 || e.codeName === "IndexNotFound") {
        console.log("ℹ️  Index client_1 did not exist.");
      } else {
        throw e;
      }
    }
  },
};
