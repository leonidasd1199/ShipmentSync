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

    // Define office permissions to assign to ops_admin
    const permissionCodes = [
      "office:list", // List offices (required for test setup and general access)
      "office:read", // Read office details
      "office:create", // Create offices
      "office:update", // Update offices
      "office:delete", // Delete offices
    ];

    // Get permission IDs
    const permissionIds = permissionCodes
      .map((code) => permissionMap.get(code))
      .filter((id) => id !== undefined);

    if (permissionIds.length === 0) {
      console.log(
        "⚠️  No office permissions found. Make sure office permissions exist.",
      );
      return;
    }

    console.log(`✅ Found ${permissionIds.length} office permissions to assign`);

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
          `✅ Assigned ${newPermissionIds.length} office permissions to user ${user.email}`,
        );
      } else {
        console.log(
          `ℹ️  User ${user.email} already has all office permissions`,
        );
      }
    }

    // Also explicitly assign to john.doe@shipsync.com if exists
    const johnDoe = await db
      .collection("users")
      .findOne({ email: "john.doe@shipsync.com" });

    if (johnDoe) {
      const existingPermissions = johnDoe.permissions || [];
      const newPermissionIds = permissionIds.filter(
        (id) =>
          !existingPermissions.some(
            (existingId) => existingId.toString() === id.toString(),
          ),
      );

      if (newPermissionIds.length > 0) {
        await db.collection("users").updateOne(
          { _id: johnDoe._id },
          { $push: { permissions: { $each: newPermissionIds } } },
        );
        console.log(
          `✅ Assigned ${newPermissionIds.length} office permissions to john.doe@shipsync.com`,
        );
        assignedCount += newPermissionIds.length;
      } else {
        console.log(
          "ℹ️  john.doe@shipsync.com already has all office permissions",
        );
      }
    } else {
      console.log("ℹ️  john.doe@shipsync.com not found, skipping explicit assignment");
    }

    console.log(
      `\n✅ Total: ${assignedCount} office permissions assigned to ops_admin users`,
    );
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
      "office:list",
      "office:read",
      "office:create",
      "office:update",
      "office:delete",
    ];

    const permissionIds = permissionCodes
      .map((code) => permissionMap.get(code))
      .filter((id) => id !== undefined);

    if (permissionIds.length === 0) {
      console.log("⚠️  No office permissions found to remove.");
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
          `🗑️  Removed ${permissionsToRemove.length} office permissions from user ${user.email}`,
        );
      }
    }

    // Also remove from john.doe@shipsync.com if exists
    const johnDoe = await db
      .collection("users")
      .findOne({ email: "john.doe@shipsync.com" });

    if (johnDoe) {
      const existingPermissions = johnDoe.permissions || [];
      const permissionsToRemove = existingPermissions.filter((id) =>
        permissionIds.some((pid) => pid.toString() === id.toString()),
      );

      if (permissionsToRemove.length > 0) {
        await db.collection("users").updateOne(
          { _id: johnDoe._id },
          { $pull: { permissions: { $in: permissionsToRemove } } },
        );
        removedCount += permissionsToRemove.length;
        console.log(
          `🗑️  Removed ${permissionsToRemove.length} office permissions from john.doe@shipsync.com`,
        );
      }
    }

    console.log(
      `\n🗑️  Total: ${removedCount} office permissions removed from ops_admin users`,
    );
  },
};
