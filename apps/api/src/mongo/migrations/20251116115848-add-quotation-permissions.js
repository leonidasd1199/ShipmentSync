module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Insert quotation permissions
    const quotationPermissions = [
      {
        code: "quotation:create",
        name: "Create Quotation",
        description: "Create new quotations",
        category: "quotation",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "quotation:read",
        name: "Read Quotation",
        description: "View quotation details",
        category: "quotation",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "quotation:update",
        name: "Update Quotation",
        description: "Modify quotation information",
        category: "quotation",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "quotation:delete",
        name: "Delete Quotation",
        description: "Remove quotations",
        category: "quotation",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "quotation:list",
        name: "List Quotations",
        description: "View quotation listings",
        category: "quotation",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert permissions if they don't exist
    for (const permission of quotationPermissions) {
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

    console.log("✅ Quotation permissions created");

    // Get the permission IDs
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map((p) => [p.code, p._id]));

    // Define role-based permissions for quotation management
    // Only ops_admin should have quotation permissions
    const rolePermissions = {
      ops_admin: [
        "quotation:create",
        "quotation:read",
        "quotation:update",
        "quotation:delete",
        "quotation:list",
      ],
    };

    // Update users with quotation permissions based on role
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

    console.log("✅ Quotation permissions assigned to users based on roles");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove quotation permissions
    await db.collection("permissions").deleteMany({
      code: {
        $in: [
          "quotation:create",
          "quotation:read",
          "quotation:update",
          "quotation:delete",
          "quotation:list",
        ],
      },
    });

    // Remove quotation permissions from users
    const permissions = await db
      .collection("permissions")
      .find({
        code: {
          $in: [
            "quotation:create",
            "quotation:read",
            "quotation:update",
            "quotation:delete",
            "quotation:list",
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

    console.log("❌ Quotation permissions removed");
  },
};

