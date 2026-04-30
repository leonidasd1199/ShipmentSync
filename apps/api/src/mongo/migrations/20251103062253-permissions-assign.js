module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Insert permissions:assign permission if it doesn't exist
    const permission = {
      code: "permissions:assign",
      name: "Assign Permissions",
      description: "Assign and remove permissions from users",
      category: "user",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existing = await db
      .collection("permissions")
      .findOne({ code: permission.code });
    if (!existing) {
      await db.collection("permissions").insertOne(permission);
      console.log("✅ Created permissions:assign permission");
    } else {
      console.log("ℹ️  permissions:assign permission already exists, skipping creation");
    }

    // Get the permission ID
    const permissionDoc = await db
      .collection("permissions")
      .findOne({ code: "permissions:assign" });
    const permissionId = permissionDoc?._id;

    if (!permissionId) {
      console.log("⚠️  Could not find permissions:assign permission ID");
      return;
    }

    // Assign this permission only to ops_admin role
    const rolePermissions = {
      ops_admin: [permissionId],
    };

    for (const [roleCode, permissionIds] of Object.entries(rolePermissions)) {
      const users = await db
        .collection("users")
        .find({ roleCode: roleCode })
        .toArray();

      for (const user of users) {
        const existingPermissions = user.permissions || [];
        if (!existingPermissions.some((id) => id.toString() === permissionId.toString())) {
          await db.collection("users").updateOne(
            { _id: user._id },
            { $push: { permissions: permissionId } },
          );
        }
      }
    }

    console.log(
      "✅ permissions:assign permission assigned to ops_admin role",
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove permissions:assign permission
    const permission = await db
      .collection("permissions")
      .findOne({ code: "permissions:assign" });

    if (permission) {
      const permissionId = permission._id;

      // Remove permission from all users
      await db.collection("users").updateMany(
        {},
        { $pull: { permissions: permissionId } },
      );

      // Delete the permission
      await db.collection("permissions").deleteOne({ code: "permissions:assign" });

      console.log("❌ Removed permissions:assign permission");
    } else {
      console.log("ℹ️  permissions:assign permission not found, skipping removal");
    }
  },
};
