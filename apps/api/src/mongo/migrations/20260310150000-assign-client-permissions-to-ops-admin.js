module.exports = {
  /**
   * Assign client:* permissions to ops_admin users so they can manage clients
   * (e.g. for e2e tests and normal app use). Migration 20251103064609 had set
   * ops_admin to only permissions:assign; this restores client management.
   *
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map((p) => [p.code, p._id]));

    const clientPermissionCodes = [
      "client:create",
      "client:read",
      "client:update",
      "client:delete",
      "client:list",
    ];
    const permissionIds = clientPermissionCodes
      .map((code) => permissionMap.get(code))
      .filter((id) => id !== undefined);

    if (permissionIds.length === 0) {
      console.log(
        "⚠️  No client permissions found. Ensure client permissions exist.",
      );
      return;
    }

    const result = await db.collection("users").updateMany(
      { roleCode: "ops_admin" },
      { $addToSet: { permissions: { $each: permissionIds } } },
    );
    console.log(
      `✅ Assigned ${permissionIds.length} client permissions to ${result.modifiedCount} ops_admin user(s).`,
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map((p) => [p.code, p._id]));

    const clientPermissionCodes = [
      "client:create",
      "client:read",
      "client:update",
      "client:delete",
      "client:list",
    ];
    const permissionIds = clientPermissionCodes
      .map((code) => permissionMap.get(code))
      .filter((id) => id !== undefined);

    if (permissionIds.length > 0) {
      await db.collection("users").updateMany(
        { roleCode: "ops_admin" },
        { $pull: { permissions: { $in: permissionIds } } },
      );
      console.log("❌ Removed client permissions from ops_admin users.");
    }
  },
};
