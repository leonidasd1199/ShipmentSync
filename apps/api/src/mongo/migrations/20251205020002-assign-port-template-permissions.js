module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Get all permissions
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map((p) => [p.code, p._id]));

    // Define permissions to assign to ops_admin
    const permissionCodes = [
      // Port permissions
      "port:create",
      "port:read",
      "port:update",
      "port:delete",
      "port:list",
      // Template permissions
      "template:create",
      "template:read",
      "template:update",
      "template:delete",
      "template:list",
    ];

    // Get permission IDs
    const permissionIds = permissionCodes
      .map((code) => permissionMap.get(code))
      .filter((id) => id !== undefined);

    if (permissionIds.length === 0) {
      console.log("⚠️  No permissions found. Make sure port and template permissions exist.");
      return;
    }

    console.log(`✅ Found ${permissionIds.length} permissions to assign`);

    // Get all ops_admin users
    const users = await db
      .collection("users")
      .find({ roleCode: "ops_admin" })
      .toArray();

    if (users.length === 0) {
      console.log("⚠️  No ops_admin users found.");
      return;
    }

    console.log(`✅ Found ${users.length} ops_admin users`);

    // Assign permissions to each ops_admin user
    let assignedCount = 0;
    for (const user of users) {
      const existingPermissions = user.permissions || [];
      const newPermissionIds = permissionIds.filter(
        (id) =>
          !existingPermissions.some(
            (existingId) => existingId.toString() === id.toString(),
          ),
      );

      if (newPermissionIds.length > 0) {
        await db.collection("users").updateOne(
          { _id: user._id },
          { $push: { permissions: { $each: newPermissionIds } } },
        );
        assignedCount += newPermissionIds.length;
        console.log(
          `✅ Assigned ${newPermissionIds.length} permissions to user ${user.email}`,
        );
      } else {
        console.log(`ℹ️  User ${user.email} already has all permissions`);
      }
    }

    console.log(`\n✅ Total: ${assignedCount} permissions assigned to ops_admin users`);
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Get permission IDs
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map((p) => [p.code, p._id]));

    const permissionCodes = [
      "port:create",
      "port:read",
      "port:update",
      "port:delete",
      "port:list",
      "template:create",
      "template:read",
      "template:update",
      "template:delete",
      "template:list",
    ];

    const permissionIds = permissionCodes
      .map((code) => permissionMap.get(code))
      .filter((id) => id !== undefined);

    if (permissionIds.length === 0) {
      console.log("⚠️  No permissions found to remove.");
      return;
    }

    // Remove permissions from ops_admin users
    const users = await db
      .collection("users")
      .find({ roleCode: "ops_admin" })
      .toArray();

    let removedCount = 0;
    for (const user of users) {
      const existingPermissions = user.permissions || [];
      const permissionsToRemove = existingPermissions.filter((id) =>
        permissionIds.some((pid) => pid.toString() === id.toString()),
      );

      if (permissionsToRemove.length > 0) {
        await db.collection("users").updateOne(
          { _id: user._id },
          { $pull: { permissions: { $in: permissionsToRemove } } },
        );
        removedCount += permissionsToRemove.length;
        console.log(
          `🗑️  Removed ${permissionsToRemove.length} permissions from user ${user.email}`,
        );
      }
    }

    console.log(`\n🗑️  Total: ${removedCount} permissions removed from ops_admin users`);
  },
};

