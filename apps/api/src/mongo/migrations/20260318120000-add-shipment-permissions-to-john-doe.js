module.exports = {
  /**
   * Grant shipment (shipping) permissions to john.doe@shipsync.com
   * - shipping:view: view shipments and documents
   * - shipping:create: create shipments
   * - shipping:update: update shipments, generate documents, manage ledger
   * @param {import('mongodb').Db} db
   */
  async up(db) {
    const userEmail = "john.doe@shipsync.com";
    const permissionCodes = [
      "shipping:view",
      "shipping:create",
      "shipping:update",
    ];

    const user = await db.collection("users").findOne({ email: userEmail });
    if (!user) {
      console.log(`⚠️  User ${userEmail} not found. Skipping.`);
      return;
    }

    const permissions = await db
      .collection("permissions")
      .find({ code: { $in: permissionCodes } })
      .toArray();

    if (permissions.length === 0) {
      console.log(
        `⚠️  None of [${permissionCodes.join(", ")}] found in permissions. Skipping.`
      );
      return;
    }

    const permissionIds = permissions.map((p) => p._id);
    const result = await db.collection("users").updateOne(
      { _id: user._id },
      { $addToSet: { permissions: { $each: permissionIds } } }
    );

    console.log(
      `✅ Added shipment permissions [${permissions.map((p) => p.code).join(", ")}] to ${userEmail}. matched: ${result.matchedCount}, modified: ${result.modifiedCount}`
    );
  },

  /**
   * Revoke shipment permissions from john.doe@shipsync.com
   * @param {import('mongodb').Db} db
   */
  async down(db) {
    const userEmail = "john.doe@shipsync.com";
    const permissionCodes = [
      "shipping:view",
      "shipping:create",
      "shipping:update",
    ];

    const user = await db.collection("users").findOne({ email: userEmail });
    if (!user) {
      console.log(`⚠️  User ${userEmail} not found. Skipping.`);
      return;
    }

    const permissions = await db
      .collection("permissions")
      .find({ code: { $in: permissionCodes } })
      .toArray();

    if (permissions.length === 0) {
      console.log(`⚠️  Permissions not found. Skipping.`);
      return;
    }

    const permissionIds = permissions.map((p) => p._id);
    const result = await db.collection("users").updateOne(
      { _id: user._id },
      { $pull: { permissions: { $in: permissionIds } } }
    );

    console.log(
      `🗑️  Removed shipment permissions from ${userEmail}. matched: ${result.matchedCount}, modified: ${result.modifiedCount}`
    );
  },
};
