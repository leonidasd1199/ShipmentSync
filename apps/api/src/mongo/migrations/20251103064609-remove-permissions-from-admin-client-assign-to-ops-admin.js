module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Remove all permissions from admin and client users
    await db.collection("users").updateMany(
      { roleCode: { $in: ["admin", "client"] } },
      { $set: { permissions: [] } }
    );
    console.log("✅ Removed all permissions from admin and client users");

    // Get the permissions:assign permission
    const permissionDoc = await db
      .collection("permissions")
      .findOne({ code: "permissions:assign" });

    if (!permissionDoc) {
      console.log("⚠️  permissions:assign permission not found, skipping assignment");
      return;
    }

    const permissionId = permissionDoc._id;

    // Remove all permissions from ops_admin users first, then assign only permissions:assign
    const opsAdminCount = await db.collection("users").countDocuments({
      roleCode: "ops_admin",
    });

    // Replace all permissions with only permissions:assign for ops_admin users
    await db.collection("users").updateMany(
      { roleCode: "ops_admin" },
      { $set: { permissions: [permissionId] } }
    );

    console.log(
      `✅ Removed all permissions from ${opsAdminCount} ops_admin users and assigned only permissions:assign`
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Get the permissions:assign permission
    const permissionDoc = await db
      .collection("permissions")
      .findOne({ code: "permissions:assign" });

    if (permissionDoc) {
      const permissionId = permissionDoc._id;

      // Remove permissions:assign from ops_admin users
      await db.collection("users").updateMany(
        { roleCode: "ops_admin" },
        { $pull: { permissions: permissionId } }
      );
      console.log("❌ Removed permissions:assign from ops_admin users");
    }

    // Note: Cannot fully restore admin/client permissions as we don't know what they had
    // Admin and client permissions remain empty after rollback
    console.log(
      "⚠️  Note: Admin and client permissions cannot be restored (were set to empty)"
    );
  }
};
