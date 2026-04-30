/** @type {import('migrate-mongo').Migration} */
module.exports = {
  async up(db, client) {
    const permissionCode = "audit:view";

    // Check if permission already exists
    const existing = await db.collection("permissions").findOne({ code: permissionCode });
    if (existing) {
      console.log(`⚠️ Permission '${permissionCode}' already exists. Skipping.`);
      return;
    }

    // Insert the new permission
    await db.collection("permissions").insertOne({
      code: permissionCode,
      name: "View Audit Logs",
      description: "Allows the user to view audit and history logs of entities.",
      category: "audit",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ Permission '${permissionCode}' added successfully.`);
  },

  async down(db, client) {
    const permissionCode = "audit:view";
    await db.collection("permissions").deleteOne({ code: permissionCode });
    console.log(`🗑️ Permission '${permissionCode}' removed.`);
  },
};
