module.exports = {
  /**
   * Backfill shipments.operator as snapshot document:
   * operator: { id, email, name }
   */
  async up(db, client) {
    const shipments = db.collection("shipments");
    const users = db.collection("users");
    const { ObjectId } = require("mongodb");

    const docs = await shipments
      .find(
        {
          $and: [
            {
              $or: [{ operator: { $exists: false } }, { "operator.id": { $exists: false } }],
            },
            {
              $or: [
                { operationalUserId: { $exists: true, $ne: null } },
                { createdBy: { $exists: true, $ne: null } },
              ],
            },
          ],
        },
        {
          projection: { _id: 1, operationalUserId: 1, createdBy: 1 },
        },
      )
      .toArray();

    if (docs.length === 0) {
      console.log("ℹ️ No shipment documents required operator snapshot backfill");
    } else {
      const operatorIds = Array.from(
        new Set(
          docs
            .map((d) => {
              const id = d.operationalUserId || d.createdBy;
              return id && id.toString ? id.toString() : null;
            })
            .filter(Boolean),
        ),
      ).map((id) => new ObjectId(id));

      const userDocs = await users
        .find(
          { _id: { $in: operatorIds } },
          { projection: { firstName: 1, lastName: 1, email: 1 } },
        )
        .toArray();
      const userById = new Map(userDocs.map((u) => [u._id.toString(), u]));

      const ops = docs.map((doc) => {
        const rawId = doc.operationalUserId || doc.createdBy;
        if (!rawId || !rawId.toString) {
          return null;
        }
        const operatorId = new ObjectId(rawId.toString());
        const user = userById.get(operatorId.toString());
        const fullName = user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : "";

        const operator = {
          id: operatorId,
          ...(user?.email ? { email: user.email } : {}),
          ...(fullName ? { name: fullName } : {}),
        };

        return {
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { operator } },
          },
        };
      }).filter(Boolean);

      if (ops.length > 0) {
        await shipments.bulkWrite(ops);
      }
      console.log(`✅ Backfilled operator snapshot for ${ops.length} shipment(s)`);
    }

    const indexes = await shipments.indexes();
    if (!indexes.some((i) => i.name === "operator.id_1")) {
      await shipments.createIndex({ "operator.id": 1 });
      console.log("✅ Created index shipments.operator.id_1");
    }
  },

  async down(db, client) {
    const shipments = db.collection("shipments");
    await shipments.updateMany(
      { "operator.id": { $exists: true } },
      { $unset: { operator: "" } },
    );
    console.log("↩️ Removed shipments.operator snapshot field");

    const indexes = await shipments.indexes();
    if (indexes.some((i) => i.name === "operator.id_1")) {
      await shipments.dropIndex("operator.id_1");
      console.log("🗑️ Dropped index shipments.operator.id_1");
    }
  },
};
