module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create permissions collection only if it doesn't exist
    const collections = await db.listCollections({ name: "permissions" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("permissions");
      console.log("✅ Created permissions collection");
    } else {
      console.log("ℹ️  Permissions collection already exists, skipping creation");
    }
    
    // Create unique index on code field
    await db.collection("permissions").createIndex({ code: 1 }, { unique: true });
    await db.collection("permissions").createIndex({ category: 1 });
    await db.collection("permissions").createIndex({ isActive: 1 });
    
    // Insert all permissions
    await db.collection("permissions").insertMany([
      // User Management
      { code: "user:create", name: "Create User", description: "Create new users", category: "user", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "user:read", name: "Read User", description: "View user details", category: "user", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "user:update", name: "Update User", description: "Modify user information", category: "user", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "user:delete", name: "Delete User", description: "Remove users", category: "user", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "user:list", name: "List Users", description: "View user listings", category: "user", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      
      // Company Management
      { code: "company:create", name: "Create Company", description: "Create new companies", category: "company", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "company:read", name: "Read Company", description: "View company details", category: "company", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "company:update", name: "Update Company", description: "Modify company information", category: "company", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "company:delete", name: "Delete Company", description: "Remove companies", category: "company", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "company:list", name: "List Companies", description: "View company listings", category: "company", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      
      // Office Management
      { code: "office:create", name: "Create Office", description: "Create new offices", category: "office", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "office:read", name: "Read Office", description: "View office details", category: "office", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "office:update", name: "Update Office", description: "Modify office information", category: "office", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "office:delete", name: "Delete Office", description: "Remove offices", category: "office", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "office:list", name: "List Offices", description: "View office listings", category: "office", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      
      // Client Management
      { code: "client:create", name: "Create Client", description: "Create new clients", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "client:read", name: "Read Client", description: "View client details", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "client:update", name: "Update Client", description: "Modify client information", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "client:delete", name: "Delete Client", description: "Remove clients", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "client:list", name: "List Clients", description: "View client listings", category: "client", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      
      // Shipment Management
      { code: "shipment:create", name: "Create Shipment", description: "Create new shipments", category: "shipment", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "shipment:read", name: "Read Shipment", description: "View shipment details", category: "shipment", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "shipment:update", name: "Update Shipment", description: "Modify shipment information", category: "shipment", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "shipment:delete", name: "Delete Shipment", description: "Remove shipments", category: "shipment", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "shipment:list", name: "List Shipments", description: "View shipment listings", category: "shipment", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "shipment:track", name: "Track Shipment", description: "Track shipment status", category: "shipment", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      
      // Reports & Analytics
      { code: "reports:view", name: "View Reports", description: "Access reporting features", category: "reports", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "analytics:view", name: "View Analytics", description: "Access analytics dashboard", category: "analytics", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      
      // System Administration
      { code: "system:config", name: "System Configuration", description: "Configure system settings", category: "system", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "system:logs", name: "System Logs", description: "Access system logs", category: "system", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { code: "system:backup", name: "System Backup", description: "Manage system backups", category: "system", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]);
    
    console.log("✅ Permissions collection created and populated");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    await db.collection("permissions").drop();
    console.log("❌ Permissions collection dropped");
  }
};
