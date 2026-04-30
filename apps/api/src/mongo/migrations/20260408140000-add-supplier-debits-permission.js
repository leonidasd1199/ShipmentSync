module.exports = {
  /**
   * Create the Supplier Debits module permission and assign it to operator-style
   * seeded users who should see the new navigation entry.
   *
   * @param {import('mongodb').Db} db
   * @returns {Promise<void>}
   */
  async up(db) {
    const now = new Date();
    const permission = {
      code: "supplier-debits:read",
      name: "Supplier Debits Access",
      description: "Access the Supplier Debits module",
      category: "finance",
    };

    let permissionDoc = await db
      .collection("permissions")
      .findOne({ code: permission.code });

    if (!permissionDoc) {
      const insertResult = await db.collection("permissions").insertOne({
        ...permission,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      permissionDoc = {
        _id: insertResult.insertedId,
        ...permission,
      };
      console.log(`✅ Created permission ${permission.code}`);
    } else {
      console.log(`ℹ️  Permission ${permission.code} already exists`);
    }

    const permissionId = permissionDoc._id;
    const result = await db.collection("users").updateMany(
      {
        $or: [
          { roleCode: "ops_admin" },
          { email: "john.doe@shipsync.com" },
        ],
      },
      { $addToSet: { permissions: permissionId } },
    );

    console.log(
      `✅ Assigned ${permission.code} to ${result.modifiedCount} user(s).`,
    );
  },

  /**
   * @param {import('mongodb').Db} db
   * @returns {Promise<void>}
   */
  async down(db) {
    const permissionDoc = await db
      .collection("permissions")
      .findOne({ code: "supplier-debits:read" });

    if (!permissionDoc) {
      console.log("ℹ️  Permission supplier-debits:read not found, skipping.");
      return;
    }

    await db.collection("users").updateMany(
      { permissions: permissionDoc._id },
      { $pull: { permissions: permissionDoc._id } },
    );

    await db.collection("permissions").deleteOne({ _id: permissionDoc._id });
    console.log("❌ Removed permission supplier-debits:read.");
  },
};
