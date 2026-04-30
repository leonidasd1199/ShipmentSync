module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Insert agent permissions
    const agentPermissions = [
      {
        code: "agent:create",
        name: "Create Agent",
        description: "Create new agents",
        category: "agent",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "agent:read",
        name: "Read Agent",
        description: "View agent details",
        category: "agent",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "agent:update",
        name: "Update Agent",
        description: "Modify agent information",
        category: "agent",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "agent:delete",
        name: "Delete Agent",
        description: "Remove agents",
        category: "agent",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "agent:list",
        name: "List Agents",
        description: "View agent listings",
        category: "agent",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Insert permissions if they don't exist
    for (const permission of agentPermissions) {
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

    console.log("✅ Agent permissions created");

    // Get the permission IDs
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map((p) => [p.code, p._id]));

    // Define role-based permissions for agent management
    // Only ops_admin should have agent permissions
    const rolePermissions = {
      ops_admin: [
        "agent:create",
        "agent:read",
        "agent:update",
        "agent:delete",
        "agent:list",
      ],
    };

    // Update users with agent permissions based on role
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

    console.log("✅ Agent permissions assigned to users based on roles");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove agent permissions
    await db.collection("permissions").deleteMany({
      code: {
        $in: [
          "agent:create",
          "agent:read",
          "agent:update",
          "agent:delete",
          "agent:list",
        ],
      },
    });

    // Remove agent permissions from users
    const permissions = await db
      .collection("permissions")
      .find({
        code: {
          $in: [
            "agent:create",
            "agent:read",
            "agent:update",
            "agent:delete",
            "agent:list",
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

    console.log("❌ Agent permissions removed");
  },
};

