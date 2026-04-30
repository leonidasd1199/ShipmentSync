module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Insert client permissions
    const clientPermissions = [
      { code: "client:create", name: "Create Client", description: "Create new clients", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "client:read", name: "Read Client", description: "View client details", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "client:update", name: "Update Client", description: "Modify client information", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "client:delete", name: "Delete Client", description: "Remove clients", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "client:list", name: "List Clients", description: "View client listings", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ];

    // Insert permissions if they don't exist
    for (const permission of clientPermissions) {
      const existing = await db.collection("permissions").findOne({ code: permission.code });
      if (!existing) {
        await db.collection("permissions").insertOne(permission);
      }
    }

    console.log("✅ Client permissions created");

    // Get the permission IDs
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map(p => [p.code, p._id]));

    // Define additional role-based permissions for client management
    const rolePermissions = {
      'ops_admin': [
        'client:create', 'client:read', 'client:update', 'client:delete', 'client:list'
      ],
      'admin': [
        'client:create', 'client:read', 'client:update', 'client:list'
      ],
      'client': [
        'client:read'
      ]
    };

    // Update users with client permissions based on role
    for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
      const permissionIds = permissionCodes
        .map(code => permissionMap.get(code))
        .filter(id => id !== undefined);

      if (permissionIds.length > 0) {
        // Get existing permissions for users with this role
        const users = await db.collection("users").find({ roleCode: roleCode }).toArray();
        
        for (const user of users) {
          const existingPermissions = user.permissions || [];
          const newPermissionIds = permissionIds.filter(id => !existingPermissions.includes(id));
          
          if (newPermissionIds.length > 0) {
            await db.collection("users").updateOne(
              { _id: user._id },
              { $push: { permissions: { $each: newPermissionIds } } }
            );
          }
        }
      }
    }

    console.log("✅ Client permissions assigned to users based on roles");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove client permissions
    await db.collection("permissions").deleteMany({ code: { $in: ['client:create', 'client:read', 'client:update', 'client:delete', 'client:list'] } });
    
    // Remove client permissions from users
    const permissions = await db.collection("permissions").find({ code: { $in: ['client:create', 'client:read', 'client:update', 'client:delete', 'client:list'] } }).toArray();
    const permissionIds = permissions.map(p => p._id);
    
    if (permissionIds.length > 0) {
      await db.collection("users").updateMany(
        {},
        { $pull: { permissions: { $in: permissionIds } } }
      );
    }

    console.log("❌ Client permissions removed");
  }
};
