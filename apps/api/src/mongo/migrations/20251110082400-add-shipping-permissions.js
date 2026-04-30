module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Insert shipping permissions
    const shippingPermissions = [
      {
        code: "shipping:create",
        name: "Create Shipping Line",
        description: "Create new shipping lines",
        category: "shipping",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "shipping:read",
        name: "Read Shipping Line",
        description: "View shipping line details",
        category: "shipping",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "shipping:update",
        name: "Update Shipping Line",
        description: "Modify shipping line information",
        category: "shipping",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "shipping:delete",
        name: "Delete Shipping Line",
        description: "Remove shipping lines",
        category: "shipping",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "shipping:list",
        name: "List Shipping Lines",
        description: "View shipping line listings",
        category: "shipping",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert permissions if they don't exist
    for (const permission of shippingPermissions) {
      const existing = await db
        .collection("permissions")
        .findOne({ code: permission.code });
      if (!existing) {
        await db.collection("permissions").insertOne(permission);
        console.log(`✅ Created permission: ${permission.code}`);
      } else {
        console.log(`ℹ️  Permission ${permission.code} already exists, skipping`);
      }
    }

    console.log("✅ Shipping permissions created");

    // Get the permission IDs
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map((p) => [p.code, p._id]));

    // Define role-based permissions for shipping management
    // Only ops_admin should have shipping permissions
    const rolePermissions = {
      ops_admin: [
        "shipping:create",
        "shipping:read",
        "shipping:update",
        "shipping:delete",
        "shipping:list",
      ],
    };

    // Update users with shipping permissions based on role
    for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
      const permissionIds = permissionCodes
        .map((code) => permissionMap.get(code))
        .filter((id) => id !== undefined);

      if (permissionIds.length > 0) {
        // Get existing permissions for users with this role
        const users = await db
          .collection("users")
          .find({ roleCode: roleCode })
          .toArray();

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
          }
        }
      }
    }

    console.log("✅ Shipping permissions assigned to users based on roles");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove shipping permissions
    await db.collection("permissions").deleteMany({
      code: {
        $in: [
          "shipping:create",
          "shipping:read",
          "shipping:update",
          "shipping:delete",
          "shipping:list",
        ],
      },
    });

    // Remove shipping permissions from users
    const permissions = await db
      .collection("permissions")
      .find({
        code: {
          $in: [
            "shipping:create",
            "shipping:read",
            "shipping:update",
            "shipping:delete",
            "shipping:list",
          ],
        },
      })
      .toArray();
    const permissionIds = permissions.map((p) => p._id);

    if (permissionIds.length > 0) {
      await db.collection("users").updateMany(
        {},
        { $pull: { permissions: { $in: permissionIds } } },
      );
    }

    console.log("❌ Shipping permissions removed");
  },
};

