module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const permissions = [
      {
        code: "template:create",
        name: "Create Template",
        description: "Allows the user to create quotation templates.",
        category: "template",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "template:read",
        name: "Read Template",
        description: "Allows the user to view quotation templates.",
        category: "template",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "template:update",
        name: "Update Template",
        description: "Allows the user to update quotation templates.",
        category: "template",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "template:delete",
        name: "Delete Template",
        description: "Allows the user to delete quotation templates.",
        category: "template",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        code: "template:list",
        name: "List Templates",
        description: "Allows the user to list quotation templates.",
        category: "template",
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
      "template:create",
      "template:read",
      "template:update",
      "template:delete",
      "template:list",
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
