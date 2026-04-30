module.exports = {
  /**
   * Grant template:read permission to john.doe@shipsync.com
   * @param {import('mongodb').Db} db
   */
  async up(db) {
    const userEmail = "john.doe@shipsync.com";
    const permissionCode = "template:read";

    const user = await db.collection("users").findOne({ email: userEmail });
    if (!user) {
      console.log(`⚠️  User ${userEmail} not found. Skipping.`);
      return;
    }

    // Ensure the permission exists (upsert)
    const permissionResult = await db.collection("permissions").findOneAndUpdate(
      { code: permissionCode },
      {
        $setOnInsert: {
          code: permissionCode,
          name: "Template Read",
          description: "Read templates",
          category: "template",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    // MongoDB Node.js driver v6 returns the document from findOneAndUpdate; v4/v5 used { value }.
    const permission =
      permissionResult == null
        ? null
        : permissionResult.value !== undefined
          ? permissionResult.value
          : permissionResult;

    if (!permission || !permission._id) {
      console.log(
        `⚠️  Could not resolve permission ${permissionCode} after upsert. Skipping.`
      );
      return;
    }

    const result = await db.collection("users").updateOne(
      { _id: user._id },
      { $addToSet: { permissions: permission._id } }
    );

    console.log(
      `✅ Added ${permissionCode} to ${userEmail}. matched: ${result.matchedCount}, modified: ${result.modifiedCount}`
    );
  },

  /**
   * Revoke template:read permission from john.doe@shipsync.com
   * @param {import('mongodb').Db} db
   */
  async down(db) {
    const userEmail = "john.doe@shipsync.com";
    const permissionCode = "template:read";

    const user = await db.collection("users").findOne({ email: userEmail });
    if (!user) {
      console.log(`⚠️  User ${userEmail} not found. Skipping.`);
      return;
    }

    const permission = await db
      .collection("permissions")
      .findOne({ code: permissionCode });
    if (!permission) {
      console.log(`⚠️  Permission ${permissionCode} not found. Skipping.`);
      return;
    }

    const result = await db.collection("users").updateOne(
      { _id: user._id },
      { $pull: { permissions: permission._id } }
    );

    console.log(
      `🗑️  Removed ${permissionCode} from ${userEmail}. matched: ${result.matchedCount}, modified: ${result.modifiedCount}`
    );
  },
};


