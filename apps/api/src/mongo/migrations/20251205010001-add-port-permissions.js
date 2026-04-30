module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const permissions = [
      {
        code: "port:create",
        name: "Create Port",
        description: "Allows the user to create ports.",
        category: "ports",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "port:read",
        name: "Read Port",
        description: "Allows the user to view port details.",
        category: "ports",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "port:update",
        name: "Update Port",
        description: "Allows the user to update ports.",
        category: "ports",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "port:delete",
        name: "Delete Port",
        description: "Allows the user to delete ports.",
        category: "ports",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "port:list",
        name: "List Ports",
        description: "Allows the user to list ports.",
        category: "ports",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const collection = db.collection("permissions");
    let addedCount = 0;
    let skippedCount = 0;

    for (const permission of permissions) {
      const existing = await collection.findOne({ code: permission.code });
      if (existing) {
        console.log(`⚠️  Permission '${permission.code}' already exists. Skipping.`);
        skippedCount++;
      } else {
        await collection.insertOne(permission);
        console.log(`✅ Permission '${permission.code}' added successfully.`);
        addedCount++;
      }
    }

    console.log(`\n📊 Summary: ${addedCount} permissions added, ${skippedCount} skipped.`);
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const permissionCodes = [
      "port:create",
      "port:read",
      "port:update",
      "port:delete",
      "port:list",
    ];

    const collection = db.collection("permissions");
    let removedCount = 0;

    for (const code of permissionCodes) {
      const result = await collection.deleteOne({ code });
      if (result.deletedCount > 0) {
        console.log(`🗑️  Permission '${code}' removed.`);
        removedCount++;
      } else {
        console.log(`ℹ️  Permission '${code}' not found, skipping.`);
      }
    }

    console.log(`\n📊 Summary: ${removedCount} permissions removed.`);
  },
};

