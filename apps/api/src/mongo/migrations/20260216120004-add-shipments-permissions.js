module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Insert shipment permissions (for shipment operations, not shipping lines)
    // Note: shipping:create and shipping:update already exist for shipping lines,
    // but we'll reuse them for shipments as well
    const shipmentPermissions = [
      {
        code: "shipping:view",
        name: "View Shipments",
        description: "View shipments and documents",
        category: "shipment",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "shipping:finance",
        name: "Finance Review",
        description: "Finance review and ledger approvals",
        category: "shipment",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "shipping:approve",
        name: "Approve Shipments",
        description: "Approve and close shipments",
        category: "shipment",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert permissions if they don't exist
    for (const permission of shipmentPermissions) {
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

    console.log("✅ Shipment permissions created");

    // Get all permission IDs (including existing shipping:create and shipping:update)
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map((p) => [p.code, p._id]));

    // Define role-based permissions for shipment management
    // All shipment-related permissions for ops_admin, plus quotation permissions needed for helper endpoints
    const rolePermissions = {
      ops_admin: [
        // Shipment permissions
        "shipping:create", // Create shipments
        "shipping:view", // View shipments and documents
        "shipping:update", // Update shipments, generate documents, manage ledger
        "shipping:finance", // Finance review and ledger approvals
        "shipping:approve", // Approve/close shipments
        // Quotation permissions needed for helper endpoints and test data
        "quotation:create", // Create quotations (required for helpers/clients and helpers/shipping-lines)
        "quotation:read", // Read quotations
        "quotation:update", // Update quotations
        "quotation:list", // List quotations
        "quotation:delete", // Delete quotations
      ],
    };

    // Update users with shipment permissions based on role
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
            console.log(
              `✅ Added shipment permissions to user: ${user.email || user._id}`,
            );
          }
        }
      }
    }

    // Also explicitly assign to john.doe@shipsync.com if exists
    const johnDoe = await db
      .collection("users")
      .findOne({ email: "john.doe@shipsync.com" });

    if (johnDoe) {
      const allPermissionIds = rolePermissions.ops_admin
        .map((code) => permissionMap.get(code))
        .filter((id) => id !== undefined);

      const existingPermissions = johnDoe.permissions || [];
      const newPermissionIds = allPermissionIds.filter(
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
          `✅ Shipment and quotation permissions assigned to john.doe@shipsync.com (${newPermissionIds.length} permissions)`,
        );
      } else {
        console.log(
          "ℹ️  john.doe@shipsync.com already has all required permissions",
        );
      }
    } else {
      console.log("ℹ️  john.doe@shipsync.com not found, skipping explicit assignment");
    }

    console.log("✅ Shipment permissions assigned to users based on roles");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove only the new shipment-specific permissions
    // Note: We don't remove shipping:create and shipping:update as they're used for shipping lines too
    await db.collection("permissions").deleteMany({
      code: {
        $in: ["shipping:view", "shipping:finance", "shipping:approve"],
      },
    });

    // Remove shipment permissions from users
    const permissions = await db
      .collection("permissions")
      .find({
        code: {
          $in: ["shipping:view", "shipping:finance", "shipping:approve"],
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

    console.log("❌ Shipment permissions removed");
  },
};
