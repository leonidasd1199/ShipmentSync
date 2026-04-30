module.exports = {
  /**
   * Normalize shipment authorization to the shipment:* family.
   * shipping:* remains reserved for shipping-line and pricing workflows.
   *
   * @param {import('mongodb').Db} db
   * @returns {Promise<void>}
   */
  async up(db) {
    const now = new Date();
    const shipmentPermissions = [
      {
        code: "shipment:finance",
        name: "Shipment Finance Review",
        description: "Finance review and ledger approvals for shipments",
        category: "shipment",
      },
      {
        code: "shipment:approve",
        name: "Shipment Approval",
        description: "Approve and close shipments",
        category: "shipment",
      },
    ];

    for (const permission of shipmentPermissions) {
      const existing = await db
        .collection("permissions")
        .findOne({ code: permission.code });
      if (!existing) {
        await db.collection("permissions").insertOne({
          ...permission,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const permissions = await db.collection("permissions").find({}).toArray();
    const permissionMap = new Map(permissions.map((p) => [p.code, p._id]));
    const permissionIdByString = new Map(
      permissions.map((p) => [p._id.toString(), p._id]),
    );

    const shipmentPermissionCodes = [
      "shipment:create",
      "shipment:read",
      "shipment:update",
      "shipment:list",
      "shipment:finance",
      "shipment:approve",
    ];

    const legacyShipmentPermissionCodes = [
      "shipping:view",
      "shipping:finance",
      "shipping:approve",
    ];

    const shipmentPermissionIds = shipmentPermissionCodes
      .map((code) => permissionMap.get(code))
      .filter((id) => id !== undefined);

    const legacyShipmentPermissionIds = legacyShipmentPermissionCodes
      .map((code) => permissionMap.get(code))
      .filter((id) => id !== undefined);

    const usersToSync = await db
      .collection("users")
      .find({
        $or: [
          { roleCode: "ops_admin" },
          { email: "john.doe@shipsync.com" },
          { permissions: { $in: legacyShipmentPermissionIds } },
        ],
      })
      .toArray();

    for (const user of usersToSync) {
      const existingPermissions = (user.permissions || []).map((id) =>
        id.toString(),
      );
      const nextPermissions = [
        ...existingPermissions.filter(
          (id) => !legacyShipmentPermissionIds.some((legacyId) => legacyId.toString() === id),
        ),
        ...shipmentPermissionIds
          .map((id) => id.toString())
          .filter((id) => !existingPermissions.includes(id)),
      ];
      const uniqueNextPermissions = [...new Set(nextPermissions)];

      await db.collection("users").updateOne(
        { _id: user._id },
        {
          $set: {
            permissions: uniqueNextPermissions
              .map((id) => permissionIdByString.get(id))
              .filter((id) => id !== undefined),
          },
        },
      );
    }

    await db.collection("permissions").deleteMany({
      code: { $in: legacyShipmentPermissionCodes },
      category: "shipment",
    });
  },

  /**
   * @param {import('mongodb').Db} db
   * @returns {Promise<void>}
   */
  async down(db) {
    const recreatedLegacyPermissions = [
      {
        code: "shipping:view",
        name: "View Shipments",
        description: "View shipments and documents",
        category: "shipment",
      },
      {
        code: "shipping:finance",
        name: "Finance Review",
        description: "Finance review and ledger approvals",
        category: "shipment",
      },
      {
        code: "shipping:approve",
        name: "Approve Shipments",
        description: "Approve and close shipments",
        category: "shipment",
      },
    ];

    const now = new Date();
    for (const permission of recreatedLegacyPermissions) {
      const existing = await db
        .collection("permissions")
        .findOne({ code: permission.code });
      if (!existing) {
        await db.collection("permissions").insertOne({
          ...permission,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await db.collection("permissions").deleteMany({
      code: { $in: ["shipment:finance", "shipment:approve"] },
    });
  },
};
