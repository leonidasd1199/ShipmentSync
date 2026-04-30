module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Add permissions field to users collection
    await db.collection("users").updateMany(
      {},
      { $set: { permissions: [] } }
    );
    
    // Get all permissions
    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map(p => [p.code, p._id]));
    
    // Define role-based permissions
    const rolePermissions = {
      'ops_admin': [
        'permissions:assign', 
      ],
      'admin': [       ],
      'client': [
        'user:read',
        'company:read',
        'office:read',
        'shipment:create', 'shipment:read', 'shipment:list', 'shipment:track',
        'reports:view'
      ]
    };
    
    // Update users with their permissions based on role
    for (const [roleCode, permissionCodes] of Object.entries(rolePermissions)) {
      const permissionIds = permissionCodes
        .map(code => permissionMap.get(code))
        .filter(id => id !== undefined);
      
      await db.collection("users").updateMany(
        { roleCode: roleCode },
        { $set: { permissions: permissionIds } }
      );
    }
    
    console.log("✅ User permissions assigned based on roles");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove permissions field from users
    await db.collection("users").updateMany(
      {},
      { $unset: { permissions: "" } }
    );
    console.log("❌ User permissions removed");
  }
};