module.exports = {
  /**
   * Add client:update-own permission and assign it to client-role users
   * so they can update their own client record via PATCH /clients/me.
   *
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    let permDoc = await db
      .collection("permissions")
      .findOne({ code: "client:update-own" });

    if (!permDoc) {
      const inserted = await db.collection("permissions").insertOne({
        code: "client:update-own",
        name: "Update Own Client",
        description: "Update own client information (client users)",
        category: "client",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      permDoc = { _id: inserted.insertedId };
      console.log("✅ Created permission client:update-own");
    } else {
      console.log("ℹ️  client:update-own permission already exists");
    }

    const result = await db.collection("users").updateMany(
      { roleCode: "client" },
      { $addToSet: { permissions: permDoc._id } },
    );
    console.log(
      `✅ Assigned client:update-own to ${result.modifiedCount} client-role user(s)`,
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const permDoc = await db
      .collection("permissions")
      .findOne({ code: "client:update-own" });

    if (permDoc) {
      await db.collection("users").updateMany(
        { roleCode: "client" },
        { $pull: { permissions: permDoc._id } },
      );
      console.log("❌ Removed client:update-own from client-role users.");
    }

    await db.collection("permissions").deleteOne({ code: "client:update-own" });
    console.log("❌ Deleted permission client:update-own");
  },
};
